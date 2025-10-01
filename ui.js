import { state } from './state.js';
import { apiFetch } from './api.js';
import { auth, saveDataToFirestore } from './firebase.js';
import { toggleFavorite, toggleSubscription } from './events.js';

const $ = (selector) => document.getElementById(selector);

// --- Core UI & Theme Management ---

const themeContent = {
    default: { title: "Entertainment Hub", subtitle: "Find where to watch your favorite shows and movies." },
    horror: { title: "The Overlook", subtitle: "All play and no work makes for a great watchlist." },
    scifi: { title: "Game Over, Man!", subtitle: "Find your next great watch before it's too late." },
    clean: { title: "There Will Be Shows", subtitle: "Find the next series you can really sink your teeth into." }
};

function updateHeaderText(theme) {
    const content = themeContent[theme] || themeContent.default;
    const loginTitle = $('loginTitle');
    const mainTitle = $('mainTitle');
    const mainSubtitle = $('mainSubtitle');
    if (loginTitle) loginTitle.textContent = content.title;
    if (mainTitle) mainTitle.textContent = content.title;
    if (mainSubtitle) mainSubtitle.textContent = content.subtitle;
}

function applyTheme(theme) {
    document.body.className = 'bg-zinc-900 text-zinc-200';
    if (['horror', 'scifi', 'clean'].includes(theme)) {
        document.body.classList.add(`theme-${theme}`);
    }
    updateHeaderText(theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        const isSelected = btn.dataset.theme === theme;
        btn.classList.toggle('bg-zinc-900', isSelected);
        btn.classList.toggle('bg-zinc-700', !isSelected);
    });
}

// --- Generic UI Components & Helpers ---

function showLoading() { $('loadingSpinner').classList.remove('hidden'); }
function hideLoading() { $('loadingSpinner').classList.add('hidden'); }
function parseLocalDate(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}
function parseTimeToMinutes(timeString) {
    if (!timeString || typeof timeString !== 'string') return 9999;
    const time = timeString.toLowerCase().trim();
    let hours = 0, minutes = 0;
    const match = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (match) {
        hours = parseInt(match[1], 10);
        minutes = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3];
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
    }
    return hours * 60 + minutes;
}

// --- Modals ---

function closeModal() { $('detailsModal').classList.add('hidden'); }
function closeSuggestionModal() { $('suggestionModal').classList.add('hidden'); }

function openSuggestionModal() {
    const title = $('suggestionModalTitle');
    const subtitle = $('suggestionModalSubtitle');
    const textarea = $('suggestionText');

    if (state.theme === 'horror') {
        title.textContent = "We Have Such Sights to Show You";
        subtitle.textContent = "What is your pleasure, sir? Let us know what features you desire.";
    } else if (state.theme === 'scifi') {
        title.textContent = "Feature Request Transmission";
        subtitle.textContent = "They mostly come at night. Mostly. But your suggestions can come anytime.";
    } else if (state.theme === 'clean') {
        title.textContent = "This is a Tasty Burger!";
        subtitle.textContent = "Enjoying your app? Let us know how we can make it even better.";
    } else {
        title.textContent = "Got a Suggestion?";
        subtitle.textContent = "We'd love to hear it. Let us know what we can do to improve your experience.";
    }
    $('suggestionModal').classList.remove('hidden');
}

function showConfirmationModal(message, onConfirm) {
    const modalContent = $('modalContent');
    modalContent.innerHTML = `
        <div class="text-center p-6">
            <h2 class="text-2xl font-bold mb-4 text-red-400">Are you sure?</h2>
            <p class="text-zinc-300 mb-6">${message}</p>
            <div class="flex justify-center space-x-4">
                <button id="confirmCancel" class="bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-2 px-6 rounded-lg transition">Cancel</button>
                <button id="confirmAction" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition">Confirm</button>
            </div>
        </div>`;
    $('detailsModal').classList.remove('hidden');
    $('confirmAction').addEventListener('click', () => {
        onConfirm();
        closeModal();
    });
    $('confirmCancel').addEventListener('click', closeModal);
}

function renderModal(details) {
    const title = details.title || details.name, year = new Date(details.release_date || details.first_air_date).getFullYear() || 'N/A';
    const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'https://placehold.co/500x750/374151/FFFFFF?text=No+Image';
    const isFavorite = state.favorites.some(fav => fav.id === details.id);
    const providers = details['watch/providers']?.results?.US?.flatrate || [];
    const mediaType = details.title ? 'movie' : 'tv';

    let providersHtml = '<p class="text-zinc-400">Not available for streaming.</p>';
    if (providers.length > 0) {
        providersHtml = providers.map(p => `<div class="flex items-center space-x-2 p-2 rounded ${state.subscriptions.includes(p.provider_id) ? 'bg-green-800' : 'bg-zinc-700'}"><img src="https://image.tmdb.org/t/p/w92${p.logo_path}" class="w-8 h-8 rounded" alt="${p.provider_name}"><span>${p.provider_name} ${state.subscriptions.includes(p.provider_id) ? '<span class="text-xs text-green-300">(Subscribed)</span>' : ''}</span></div>`).join('');
    }

    let scoreHtml = '';
    if (details.vote_average && details.vote_count > 10) {
        const score = Math.round(details.vote_average * 10);
        let scoreColor = 'bg-zinc-600', borderColor = 'border-zinc-500';
        if (score >= 70) { scoreColor = 'bg-green-600'; borderColor = 'border-green-400'; }
        else if (score >= 40) { scoreColor = 'bg-yellow-600'; borderColor = 'border-yellow-400'; }
        else if (score > 0) { scoreColor = 'bg-red-600'; borderColor = 'border-red-400'; }
        scoreHtml = `<div class="flex items-center space-x-3 mb-4"><div class="w-12 h-12 rounded-full flex items-center justify-center ${scoreColor} text-white font-bold text-lg border-2 ${borderColor}">${score}<span class="text-xs">%</span></div><span class="font-semibold text-lg">User Score</span></div>`;
    }
    
    let manualTimeHtml = '';
    if (mediaType === 'tv') {
        const favorite = state.favorites.find(f => f.id === details.id);
        if (favorite) {
            manualTimeHtml = `<div class="mt-4 pt-4 border-t border-zinc-700"><h3 class="text-xl font-semibold mb-2">Manual Air Time</h3><p class="text-zinc-400 text-sm mb-2">Set a time to help sort your schedule (e.g., "9:00 PM EST").</p><div id="manualTimeContainer" class="flex items-center space-x-4"><p id="manualTimeDisplay" class="text-zinc-300 flex-grow">${favorite.manualTime || 'Not set'}</p><button id="editTimeButton" class="bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-1 px-3 rounded text-sm">Edit</button></div></div>`;
        }
    }
    
    $('modalContent').innerHTML = `<button id="closeModal" class="absolute top-4 right-4 text-zinc-400 hover:text-white text-3xl leading-none">&times;</button><div class="flex flex-col md:flex-row gap-6"><div class="md:w-1/3 flex-shrink-0"><img src="${posterUrl}" alt="${title}" class="w-full rounded-lg shadow-md"></div><div class="md:w-2/3"><h2 class="text-3xl font-bold mb-2">${title} (${year})</h2><p class="text-zinc-400 mb-4 text-sm">${details.overview || 'No overview.'}</p>${scoreHtml}<div class="flex gap-4 mb-6"><button id="favoriteButton" class="w-full ${isFavorite ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-700 hover:bg-zinc-600'} text-white font-bold py-2 px-4 rounded transition">${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</button><a href="https://www.themoviedb.org/${mediaType}/${details.id}" target="_blank" rel="noopener noreferrer" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition text-center">See More</a></div><h3 class="text-xl font-semibold mb-2">Watch On:</h3><div class="flex flex-wrap gap-2 mb-6">${providersHtml}</div>${manualTimeHtml}</div></div>`;
    
    if($('favoriteButton')) $('favoriteButton').addEventListener('click', () => toggleFavorite(details));
    if($('editTimeButton')) $('editTimeButton').addEventListener('click', () => editManualTime(details));
    if($('closeModal')) $('closeModal').addEventListener('click', closeModal);
    
    $('detailsModal').classList.remove('hidden');
}

function editManualTime(details) {
    const favorite = state.favorites.find(f => f.id === details.id);
    if (!favorite) return;

    const container = $('manualTimeContainer');
    container.innerHTML = `
        <div class="flex-grow">
            <input type="text" id="timeInput" class="w-full bg-zinc-700 border border-zinc-600 rounded-md py-1 px-2 text-white" value="${favorite.manualTime || ''}" placeholder="e.g., 9:00 PM EST">
        </div>
        <div class="flex space-x-2">
            <button id="saveTimeButton" class="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-1 px-3 rounded text-sm">Save</button>
            <button id="cancelTimeButton" class="bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-1 px-3 rounded text-sm">Cancel</button>
        </div>
    `;

    $('saveTimeButton').addEventListener('click', () => {
        const newTime = $('timeInput').value.trim();
        const favIndex = state.favorites.findIndex(f => f.id === details.id);
        if (favIndex > -1) {
            state.favorites[favIndex].manualTime = newTime;
        }
        saveDataToFirestore();
        renderModal(details); 
    });
    $('cancelTimeButton').addEventListener('click', () => renderModal(details));
}

// --- Media Details & Cards ---

async function getMediaDetails(id, type) {
    showLoading();
    try {
        const data = await apiFetch(`${type}/${id}?append_to_response=watch/providers,credits`);
        renderModal(data);
    } catch (error) {
        console.error('Failed to get details:', error);
    } finally {
        hideLoading();
    }
}

function createMediaCard(item, isManageMode = false) {
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'relative favorite-card';

    const card = document.createElement('div');
    card.className = 'bg-zinc-800 rounded-lg overflow-hidden shadow-lg transform hover:scale-105 transition duration-300 h-full';
    card.dataset.id = item.id;
    card.dataset.type = item.media_type || (item.title ? 'movie' : 'tv');
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
    const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://placehold.co/500x750/374151/FFFFFF?text=No+Image';
    card.innerHTML = `<img src="${posterUrl}" alt="${title}" class="w-full h-auto object-cover transition-all duration-300"><div class="p-4"><h3 class="font-bold text-md truncate">${title}</h3><p class="text-sm text-zinc-400">${year}</p></div>`;
    
    if (isManageMode) {
        const overlay = document.createElement('div');
        overlay.className = 'favorite-card-manage-overlay';
        overlay.innerHTML = `<svg class="x-mark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="rgba(239, 68, 68, 0.7)"/><path stroke="white" stroke-width="5" d="M16 16 36 36 M36 16 16 36" /></svg>`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'favorite-card-manage-checkbox w-full h-full absolute top-0 left-0';
        checkbox.value = item.id;
        overlay.appendChild(checkbox);
        cardWrapper.appendChild(overlay);
        cardWrapper.addEventListener('click', (e) => {
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
            cardWrapper.classList.toggle('selected');
            updateSelectedCount(card.dataset.type);
        });
    } else {
        card.classList.add('cursor-pointer');
        card.addEventListener('click', () => getMediaDetails(item.id, card.dataset.type));
    }
    cardWrapper.appendChild(card);
    return cardWrapper;
}

// --- Search ---

function renderSearchResults(mediaResults = []) {
    const container = $('searchResultsContainer');
    const message = $('searchResultsMessage');
    const validMedia = mediaResults.filter(item => item.media_type !== 'person' && item.poster_path);
    container.innerHTML = '';
    message.classList.add('hidden');
    if (validMedia.length === 0) {
        message.textContent = 'No results found.';
        message.classList.remove('hidden');
        return;
    }
    validMedia.forEach(item => container.appendChild(createMediaCard(item)));
}

function renderLiveSearchResults(results = []) {
    const container = $('liveSearchResults');
    container.innerHTML = '';
    const validResults = results.filter(item => item.media_type !== 'person' && item.poster_path).slice(0, 5);
    if (validResults.length === 0) {
        container.classList.add('hidden');
        return;
    }
    validResults.forEach(item => {
        const title = item.title || item.name;
        const el = document.createElement('div');
        el.className = 'flex items-center space-x-3 p-3 hover:bg-zinc-700 cursor-pointer';
        el.innerHTML = `<img src="https://image.tmdb.org/t/p/w92${item.poster_path}" class="w-10 h-auto rounded-md"><span>${title}</span>`;
        el.addEventListener('click', () => {
            getMediaDetails(item.id, item.media_type);
            container.classList.add('hidden');
            $('searchInput').value = '';
        });
        container.appendChild(el);
    });
    container.classList.remove('hidden');
}

// --- App Initialization & Page Switching ---

async function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    const tabEl = $(tabName);
    if (tabEl) tabEl.classList.remove('hidden');
    
    document.querySelectorAll('.tab-button').forEach(tab => {
        const isCurrentTab = tab.dataset.tab === tabName;
        tab.classList.toggle('border-zinc-400', isCurrentTab);
        tab.classList.toggle('border-transparent', !isCurrentTab);
    });

    if (tabName === 'dashboard') await fetchDashboardData();
    if (tabName === 'favorites') await renderFavorites();
    if (tabName === 'schedule') { await fetchScheduleData(); renderSchedule(); }
}

function updateAccountSection() {
    const user = auth.currentUser;
    if (user) {
        $('accountSection').innerHTML = `<h2 class="text-2xl font-bold mb-4">Account</h2><p class="text-zinc-400 mb-4">Signed in as ${user.displayName || user.email}</p><button id="signOutButton" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition">Sign Out</button>`;
        $('signOutButton').addEventListener('click', () => import('./firebase.js').then(m => m.handleSignOut()));
        $('deleteAccountBtn').addEventListener('click', () => showConfirmationModal("Are you sure you want to delete your account?", () => import('./firebase.js').then(m => m.handleDeleteAccount())));
    }
}

async function initAppUI() {
    updateAccountSection();
    renderSubscriptions();
    updateUpcomingFilterButtonsUI();
    await switchTab('dashboard');
}

async function refreshCurrentView() {
    updateAccountSection();
    renderSubscriptions();
    updateUpcomingFilterButtonsUI();
    $('dashboardUserName').textContent = state.userName || 'You';
    
    if (state.activeTab === 'dashboard') await fetchDashboardData();
    if (state.activeTab === 'favorites') await renderFavorites();
    if (state.activeTab === 'schedule') { await fetchScheduleData(); renderSchedule(); }
}

// --- Dashboard ---

async function fetchDashboardData() {
    showLoading();
    try {
        $('dashboardUserName').textContent = state.userName || 'You';
        const trendingPromise = apiFetch(`trending/all/day`);
        const upcomingPromise = apiFetch(`movie/upcoming`);
        const [trendingData, upcomingData] = await Promise.all([trendingPromise, upcomingPromise, fetchScheduleData(true)]);
        
        renderDashboardTrending(trendingData.results);
        renderDashboardUpcomingMovies(upcomingData.results);
        renderDashboardUpcoming();
        await renderSpotlight(upcomingData.results);
        await renderRecommendations();

    } catch (error) {
        console.error("Failed to load dashboard:", error);
        $('upcomingContainer').innerHTML = `<p class="text-zinc-500 text-sm">Could not load dashboard data.</p>`;
    } finally {
        hideLoading();
    }
}

function renderDashboardTrending(items = []) {
    const trendingContainer = $('trendingContainer');
    trendingContainer.innerHTML = '';
    if (items.length === 0) return;
    items.filter(item => item.poster_path).forEach(item => {
        const card = document.createElement('div');
        card.className = 'flex-shrink-0 w-32 cursor-pointer';
        card.innerHTML = `<img src="https://image.tmdb.org/t/p/w342${item.poster_path}" class="rounded-lg"><p class="text-sm mt-2 truncate">${item.title || item.name}</p>`;
        card.addEventListener('click', () => getMediaDetails(item.id, item.media_type));
        trendingContainer.appendChild(card);
    });
}

function renderDashboardUpcomingMovies(items = []) {
    const upcomingMoviesContainer = $('upcomingMoviesContainer');
    upcomingMoviesContainer.innerHTML = '';
    if (items.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysHence = new Date(today);
    fourteenDaysHence.setDate(today.getDate() + 14);

    const filteredAndSortedMovies = items
        .filter(item => {
            const releaseDate = parseLocalDate(item.release_date);
            return item.poster_path && releaseDate && releaseDate >= sevenDaysAgo && releaseDate <= fourteenDaysHence;
        })
        .sort((a, b) => parseLocalDate(a.release_date) - parseLocalDate(b.release_date));

    if (filteredAndSortedMovies.length === 0) return;

    filteredAndSortedMovies.forEach(item => {
        const card = document.createElement('div');
        card.className = 'flex-shrink-0 w-32 cursor-pointer';
        const releaseDate = new Date(item.release_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        card.innerHTML = `<img src="https://image.tmdb.org/t/p/w342${item.poster_path}" class="rounded-lg"><p class="text-sm mt-2 truncate">${item.title}</p><p class="text-xs text-zinc-300">${releaseDate}</p>`;
        card.addEventListener('click', () => getMediaDetails(item.id, 'movie'));
        upcomingMoviesContainer.appendChild(card);
    });
}

async function renderSpotlight(upcomingMovies) {
    const spotlightSection = $('spotlightSection');
    const spotlightContainer = $('spotlightContainer');
    spotlightContainer.innerHTML = '';
    spotlightSection.classList.add('hidden');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysHence = new Date(today);
    sevenDaysHence.setDate(today.getDate() + 7);

    const favoriteMovieIds = new Set(state.favorites.filter(f => f.media_type === 'movie').map(f => f.id));
    const upcomingFavoriteMovies = upcomingMovies.filter(movie => {
        const releaseDate = parseLocalDate(movie.release_date);
        return favoriteMovieIds.has(movie.id) && releaseDate >= sevenDaysAgo && releaseDate <= sevenDaysHence;
    }).map(m => ({...m, media_type: 'movie'}));

    const favoriteShowIds = new Set(state.favorites.filter(f => f.media_type === 'tv').map(f => f.id));
    const groupedEpisodes = state.scheduledEpisodes.reduce((acc, ep) => {
        if (!favoriteShowIds.has(ep.showId)) return acc;
        const key = `${ep.showId}-${ep.air_date}`;
        if (!acc[key]) { acc[key] = { ...ep }; }
        return acc;
    }, {});

    const upcomingFavoriteShows = Object.values(groupedEpisodes).filter(show => {
        const airDate = parseLocalDate(show.air_date);
        return airDate >= sevenDaysAgo && airDate <= sevenDaysHence;
    }).map(s => ({ id: s.showId, title: s.showName, release_date: s.air_date, poster_path: s.poster_path, media_type: 'tv' }));

    const potentialHighlights = [...upcomingFavoriteMovies, ...upcomingFavoriteShows];
    if (potentialHighlights.length === 0) return;
    potentialHighlights.sort((a, b) => parseLocalDate(a.release_date) - parseLocalDate(b.release_date));

    let focusIndex = potentialHighlights.findIndex(item => parseLocalDate(item.release_date) >= today);
    if (focusIndex === -1 && potentialHighlights.length > 0) focusIndex = potentialHighlights.length - 1;

    potentialHighlights.forEach((item, index) => {
        if (!item.poster_path) return;
        const card = document.createElement('div');
        card.id = `spotlight-item-${index}`;
        card.className = 'flex-shrink-0 w-32 cursor-pointer';
        const releaseDate = parseLocalDate(item.release_date);
        const diffDays = Math.round((releaseDate - today) / (1000 * 60 * 60 * 24));
        let releaseText = '';
        if (diffDays === 0) releaseText = 'Today';
        else if (diffDays === 1) releaseText = 'Tomorrow';
        else if (diffDays > 1) releaseText = `In ${diffDays} days`;
        else if (diffDays === -1) releaseText = 'Yesterday';
        else releaseText = `${Math.abs(diffDays)} days ago`;
        card.innerHTML = `<img src="https://image.tmdb.org/t/p/w342${item.poster_path}" class="rounded-lg"><p class="text-sm mt-2 truncate font-bold">${item.title || item.name}</p><p class="text-xs text-red-400 font-semibold">${releaseText}</p>`;
        card.addEventListener('click', () => getMediaDetails(item.id, item.media_type));
        spotlightContainer.appendChild(card);
    });
    spotlightSection.classList.remove('hidden');
    if (focusIndex !== -1) {
        setTimeout(() => {
            const elementToFocus = $(`spotlight-item-${focusIndex}`);
            if (elementToFocus) {
                spotlightContainer.scrollTo({ left: elementToFocus.offsetLeft - 16, behavior: 'smooth' });
            }
        }, 100);
    }
}

async function renderRecommendations() {
    const recommendationsSection = $('recommendationsSection');
    const recommendationsContainer = $('recommendationsContainer');
    recommendationsSection.classList.add('hidden');
    recommendationsContainer.innerHTML = '';
    if (state.favorites.length < 3) return;
    try {
        const detailPromises = state.favorites.map(fav => apiFetch(`${fav.media_type}/${fav.id}?append_to_response=keywords`));
        const detailResults = await Promise.allSettled(detailPromises);
        const favoriteDetails = detailResults.filter(r => r.status === 'fulfilled').map(r => r.value);
        if (favoriteDetails.length === 0) return;

        const genreCounts = new Map(), keywordCounts = new Map();
        favoriteDetails.forEach(detail => {
            (detail.genres || []).forEach(g => genreCounts.set(g.id, (genreCounts.get(g.id) || 0) + 1));
            const keywords = detail.keywords?.keywords || detail.keywords?.results || [];
            keywords.forEach(k => keywordCounts.set(k.id, (keywordCounts.get(k.id) || 0) + 1));
        });

        const topGenreIds = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(g => g[0]).join('|');
        const topKeywordIds = [...keywordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(k => k[0]).join('|');
        if (!topGenreIds && !topKeywordIds) return;

        const moviePromise = apiFetch(`discover/movie?with_genres=${topGenreIds}&with_keywords=${topKeywordIds}&sort_by=popularity.desc`);
        const tvPromise = apiFetch(`discover/tv?with_genres=${topGenreIds}&with_keywords=${topKeywordIds}&sort_by=popularity.desc`);
        const [movieResults, tvResults] = await Promise.allSettled([moviePromise, tvPromise]);
        
        const favoriteIds = new Set(state.favorites.map(f => f.id));
        const combined = [
            ...(movieResults.status === 'fulfilled' ? movieResults.value.results : []),
            ...(tvResults.status === 'fulfilled' ? tvResults.value.results : [])
        ].filter(item => item.poster_path && !favoriteIds.has(item.id))
         .sort((a, b) => b.popularity - a.popularity).slice(0, 20);

        if (combined.length > 0) {
            combined.forEach(item => {
                const card = document.createElement('div');
                card.className = 'flex-shrink-0 w-32 cursor-pointer';
                card.innerHTML = `<img src="https://image.tmdb.org/t/p/w342${item.poster_path}" class="rounded-lg"><p class="text-sm mt-2 truncate">${item.title || item.name}</p>`;
                card.addEventListener('click', () => getMediaDetails(item.id, item.media_type || (item.title ? 'movie' : 'tv')));
                recommendationsContainer.appendChild(card);
            });
            recommendationsSection.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Failed to load recommendations:", error);
    }
}


function updateUpcomingFilterButtonsUI() {
    document.querySelectorAll('.upcoming-filter-btn').forEach(b => {
        const isSelected = b.dataset.filter === state.dashboardScheduleFilter;
        b.classList.toggle('bg-zinc-900', isSelected);
    });
}

function renderDashboardUpcoming() {
    const upcomingContainer = $('upcomingContainer');
    upcomingContainer.innerHTML = '';
    const today = new Date(); today.setHours(0,0,0,0);
    let endDate = new Date(today);
    if (state.dashboardScheduleFilter === 'week') { endDate.setDate(today.getDate() + 6); } 
    else if (state.dashboardScheduleFilter === 'month') { endDate.setMonth(today.getMonth() + 1); }

    const upcoming = state.scheduledEpisodes
        .map(ep => ({ ...ep, manualTime: (state.favorites.find(f => f.id === ep.showId) || {}).manualTime }))
        .filter(ep => { const airDate = parseLocalDate(ep.air_date); return airDate >= today && airDate <= endDate; })
        .sort((a,b) => {
            const dateA = parseLocalDate(a.air_date), dateB = parseLocalDate(b.air_date);
            if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
            return parseTimeToMinutes(a.manualTime) - parseTimeToMinutes(b.manualTime);
        });

    const groupedUpcoming = upcoming.reduce((acc, ep) => {
        const key = `${ep.showId}-${ep.air_date}`;
        if (!acc[key]) { acc[key] = { ...ep, episodes: [] }; }
        acc[key].episodes.push({ season_number: ep.season_number, episode_number: ep.episode_number, name: ep.name });
        return acc;
    }, {});
    const upcomingItems = Object.values(groupedUpcoming);

    if (upcomingItems.length === 0) {
        upcomingContainer.innerHTML = `<p class="text-zinc-500 text-sm">No episodes scheduled in this period.</p>`;
        return;
    }
    
    upcomingItems.forEach(item => {
        const el = document.createElement('div');
        el.className = 'flex items-center space-x-4 p-3 bg-zinc-700 rounded-lg';
        const airDate = parseLocalDate(item.air_date);
        const day = airDate.toLocaleDateString(undefined, { weekday: 'short' });
        const date = airDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        let networkHtml = '';
        if (item.displayNetwork?.logo_path) { networkHtml = `<img src="https://image.tmdb.org/t/p/w92${item.displayNetwork.logo_path}" class="h-6 object-contain" title="${item.displayNetwork.name}">`; }
        else if (item.displayNetwork) { networkHtml = `<span class="text-xs text-zinc-400">${item.displayNetwork.name}</span>`; }
        let episodeDetailsText = item.episodes.length > 1 ? `${item.episodes.length} episodes today` : `S${item.episodes[0].season_number} E${item.episodes[0].episode_number}: ${item.episodes[0].name}`;
        el.innerHTML = `<div class="text-center w-20 flex-shrink-0"><p class="font-bold text-xl text-zinc-300">${day}</p><p class="text-sm text-zinc-400">${date}</p></div><div class="flex-grow min-w-0"><p class="font-bold">${item.showName}</p><p class="text-sm text-zinc-400 truncate">${episodeDetailsText}</p><p class="text-sm font-semibold text-zinc-300 mt-1">${item.manualTime || ''}</p></div><div class="flex flex-col items-center justify-center w-16 flex-shrink-0 space-y-2"><img src="https://image.tmdb.org/t/p/w92${item.poster_path}" class="w-12 h-auto rounded-md"><div class="h-6 flex items-center justify-center">${networkHtml}</div></div>`;
        upcomingContainer.appendChild(el);
    });
}

// --- Favorites ---

async function renderFavorites() {
    const movieFavorites = state.favorites.filter(f => f.media_type === 'movie');
    const tvFavorites = state.favorites.filter(f => f.media_type === 'tv');
    await renderFavoriteSection('movie', movieFavorites);
    await renderFavoriteSection('tv', tvFavorites);
}

async function renderFavoriteSection(type, items) {
    const isManaging = type === 'movie' ? state.isManagingMovies : state.isManagingTvs;
    const view = type === 'movie' ? state.movieFavoritesView : state.tvFavoritesView;
    const viewControls = $(`${type}-favorites-view-controls`);
    const manageControls = $(`${type}-favorites-manage-controls`);
    const messageEl = $(`${type}FavoritesMessage`);
    const gridContainer = $(`${type}FavoritesContainer`);
    const listContainer = $(`${type}FavoritesListContainer`);

    viewControls.parentElement.classList.toggle('hidden', isManaging);
    manageControls.classList.toggle('hidden', !isManaging);
    messageEl.classList.toggle('hidden', items.length > 0);
    if (items.length === 0) {
        gridContainer.innerHTML = ''; listContainer.innerHTML = '';
        messageEl.textContent = `You have no favorite ${type}s.`;
        return;
    }
    const sortedItems = [...items].sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));

    if (view === 'grid') {
        gridContainer.classList.remove('hidden'); listContainer.classList.add('hidden');
        gridContainer.innerHTML = '';
        sortedItems.forEach(item => gridContainer.appendChild(createMediaCard(item, isManaging)));
    } else {
        gridContainer.classList.add('hidden'); listContainer.classList.remove('hidden');
        await renderFavoritesList(sortedItems, listContainer);
    }
    updateSelectedCount(type);
}

async function renderFavoritesList(sortedFavorites, container) {
    container.innerHTML = '';
    if(sortedFavorites.length === 0) return;
    showLoading();
    try {
        const providerPromises = sortedFavorites.map(fav => apiFetch(`${fav.media_type}/${fav.id}?append_to_response=watch/providers`));
        const favoritesWithDetails = await Promise.all(providerPromises);

        favoritesWithDetails.forEach(details => {
            const title = details.title || details.name;
            const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w92${details.poster_path}` : 'https://placehold.co/92x138/374151/FFFFFF?text=N/A';
            const providers = details['watch/providers']?.results?.US?.flatrate || [];
            let providersHtml = '<span class="text-zinc-400 text-sm">Not on streaming</span>';
            if (providers.length > 0) {
                providersHtml = providers.map(p => `<img src="https://image.tmdb.org/t/p/w92${p.logo_path}" class="h-8 w-8 rounded-md object-cover" title="${p.provider_name}">`).join('');
            }
            const listItem = document.createElement('div');
            listItem.className = 'flex items-center space-x-4 p-3 bg-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-700';
            listItem.innerHTML = `<img src="${posterUrl}" class="w-12 h-auto rounded-md flex-shrink-0"><div class="flex-grow min-w-0"><p class="font-bold truncate">${title}</p></div><div class="flex flex-wrap gap-2 justify-end items-center flex-shrink" style="max-width: 50%;">${providersHtml}</div>`;
            listItem.addEventListener('click', () => getMediaDetails(details.id, details.title ? 'movie' : 'tv'));
            container.appendChild(listItem);
        });
    } catch (error) {
        console.error("Error fetching favorites details:", error);
        container.innerHTML = `<p class="text-center text-red-400">Could not load details.</p>`;
    } finally {
        hideLoading();
    }
}

function updateSelectedCount(type) {
    const container = $(`${type}FavoritesContainer`);
    const countEl = $(`${type}FavoritesSelectedCount`);
    if (!container || !countEl) return;
    const selected = container.querySelectorAll('.favorite-card-manage-checkbox:checked');
    countEl.textContent = `${selected.length} selected`;
}


// --- Schedule ---

async function fetchScheduleData(isDashboard = false) {
    const favoriteTvShows = state.favorites.filter(fav => fav.media_type === 'tv');
    if (!isDashboard) $('scheduleMessage').classList.add('hidden');
    if (favoriteTvShows.length === 0) { state.scheduledEpisodes = []; return; }
    if (!isDashboard) showLoading();
    try {
        const showPromises = favoriteTvShows.map(s => apiFetch(`tv/${s.id}?append_to_response=watch/providers`));
        const showDetailsList = await Promise.all(showPromises);
        const seasonPromises = [];
        for (const showDetail of showDetailsList) {
            if (showDetail.seasons && Array.isArray(showDetail.seasons)) {
                const futureSeasons = showDetail.seasons.filter(s => s.air_date && new Date(s.air_date) > new Date());
                let seasonToFetch = futureSeasons.sort((a,b) => new Date(a.air_date) - new Date(b.air_date))[0];
                if(!seasonToFetch) seasonToFetch = showDetail.seasons.filter(s => s.season_number > 0).sort((a, b) => b.season_number - a.season_number)[0];
                if (seasonToFetch) seasonPromises.push(apiFetch(`tv/${showDetail.id}/season/${seasonToFetch.season_number}`).then(sData => ({...sData, showId: showDetail.id, showName: showDetail.name, showPoster: showDetail.poster_path, networks: showDetail.networks, providers: showDetail['watch/providers'] })));
            }
        }
        const seasonDetailsList = await Promise.all(seasonPromises);
        const allEpisodes = [];
        for (const season of seasonDetailsList) {
            if (season.episodes) {
                const us_providers = season.providers?.results?.US?.flatrate || [];
                const subscribedProvider = us_providers.find(p => state.subscriptions.includes(p.provider_id));
                let displayNetwork = subscribedProvider ? { name: subscribedProvider.provider_name, logo_path: subscribedProvider.logo_path } : (season.networks?.[0] || null);
                const episodesWithContext = season.episodes.filter(ep => ep.air_date).map(ep => ({ ...ep, showId: season.showId, showName: season.showName, poster_path: season.showPoster, displayNetwork }));
                allEpisodes.push(...episodesWithContext);
            }
        }
        state.scheduledEpisodes = allEpisodes;
    } catch (error) {
        console.error("Error fetching schedule data:", error);
        if (!isDashboard) $('scheduleMessage').textContent = "Could not load schedule data.";
        state.scheduledEpisodes = [];
    } finally {
        if (!isDashboard) hideLoading();
    }
}

function renderSchedule() {
    $('scheduleMessage').classList.add('hidden');
    if (state.scheduledEpisodes.length === 0) {
        $('scheduleMessage').textContent = "No upcoming episodes for your favorite shows.";
        $('scheduleMessage').classList.remove('hidden');
        $('scheduleContent').innerHTML = '';
        return;
    }
    if (state.scheduleView === 'calendar') renderCalendar();
    else renderAgenda();
}

function renderCalendar() {
    const date = state.currentDate;
    const year = date.getFullYear(), month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = date.toLocaleString('default', { month: 'long' });
    let html = `<div class="p-4"><div class="flex justify-between items-center mb-4"><button id="prevMonth" class="px-2 py-1">&lt;</button><h3 class="text-xl font-semibold">${monthName} ${year}</h3><button id="nextMonth" class="px-2 py-1">&gt;</button></div><div class="grid grid-cols-7 gap-2 text-center text-xs text-zinc-400"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div><div id="calendarGrid" class="grid grid-cols-7 gap-2 mt-2">`;
    for (let i = 0; i < firstDayOfWeek; i++) { html += `<div></div>`; }
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        const dayEvents = state.scheduledEpisodes.filter(ep => parseLocalDate(ep.air_date)?.getTime() === dayDate.getTime());
        const uniqueShowNames = [...new Set(dayEvents.map(e => e.showName))];
        html += `<div class="p-2 h-20 border border-zinc-700 rounded-md text-xs overflow-hidden ${dayEvents.length > 0 ? 'bg-zinc-900' : ''}"><div class="font-bold">${day}</div><div class="truncate">${uniqueShowNames.join(', ')}</div></div>`;
    }
    html += `</div></div>`;
    $('scheduleContent').innerHTML = html;
    $('prevMonth').addEventListener('click', () => { state.currentDate.setMonth(month - 1); renderCalendar(); });
    $('nextMonth').addEventListener('click', () => { state.currentDate.setMonth(month + 1); renderCalendar(); });
}

function renderAgenda() {
    const sortedEpisodes = [...state.scheduledEpisodes]
        .map(ep => ({ ...ep, manualTime: (state.favorites.find(f => f.id === ep.showId) || {}).manualTime }))
        .sort((a,b) => {
            const dateA = parseLocalDate(a.air_date), dateB = parseLocalDate(b.air_date);
            if (!dateA) return 1; if (!dateB) return -1;
            if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
            return parseTimeToMinutes(a.manualTime) - parseTimeToMinutes(b.manualTime);
        });
    
    const groupedEpisodes = sortedEpisodes.reduce((acc, ep) => {
        const key = `${ep.showId}-${ep.air_date}`;
        if (!acc[key]) { acc[key] = { ...ep, episodes: [] }; }
        acc[key].episodes.push({ id: ep.id, season_number: ep.season_number, episode_number: ep.episode_number, name: ep.name });
        return acc;
    }, {});
    const agendaItems = Object.values(groupedEpisodes);

    const today = new Date(); today.setHours(0, 0, 0, 0);

    $('scheduleContent').innerHTML = `<div class="space-y-4">${agendaItems.map(item => {
        const airDate = parseLocalDate(item.air_date);
        if (!airDate) return '';
        const isPast = airDate < today;
        let networkHtml = '';
        if (item.displayNetwork?.logo_path) { networkHtml = `<img src="https://image.tmdb.org/t/p/w92${item.displayNetwork.logo_path}" class="h-6 object-contain" alt="${item.displayNetwork.name}">`; }
        else if (item.displayNetwork) { networkHtml = `<span class="text-sm text-zinc-400">${item.displayNetwork.name}</span>`; }
        let episodeDetailsHtml = item.episodes.length > 1 ? `<p class="text-sm text-zinc-400 truncate">S${item.episodes[0].season_number}: ${item.episodes.map(e => `E${e.episode_number}`).join(', ')}</p>` : `<p class="text-sm text-zinc-400 truncate">S${item.episodes[0].season_number} E${item.episodes[0].episode_number}: ${item.episodes[0].name}</p>`;
        const agendaItemId = `agenda-item-${item.showId}-${item.air_date.replace(/-/g, '')}`;
        return `<div id="${agendaItemId}" class="flex items-center space-x-4 p-3 bg-zinc-700 rounded-lg ${isPast ? 'opacity-50' : ''}"><img src="https://image.tmdb.org/t/p/w92${item.poster_path}" class="w-12 h-auto rounded-md flex-shrink-0"><div class="flex-grow min-w-0"><p class="font-bold">${item.showName}</p>${episodeDetailsHtml}</div><div class="text-right flex-shrink-0 w-32"><p class="font-bold text-zinc-300 text-md">${airDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p><p class="text-sm text-zinc-300">${item.manualTime || ''}</p><div class="mt-1 h-6 flex justify-end items-center">${networkHtml}</div></div></div>`;
    }).join('')}</div>`;

    const firstUpcomingIndex = agendaItems.findIndex(item => parseLocalDate(item.air_date) >= today);
    if (firstUpcomingIndex !== -1) {
        const item = agendaItems[firstUpcomingIndex];
        setTimeout(() => {
            const element = $(`agenda-item-${item.showId}-${item.air_date.replace(/-/g, '')}`);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}

// --- Settings ---

function renderSubscriptions() {
    const subscriptionList = $('subscriptionList');
    subscriptionList.innerHTML = '';
    state.streamingServices.forEach(service => {
        const isChecked = state.subscriptions.includes(service.id);
        const item = document.createElement('div');
        item.className = `flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition duration-300 ${isChecked ? 'bg-zinc-900' : 'bg-zinc-700'}`;
        item.dataset.serviceId = service.id;
        item.innerHTML = `<img src="https://image.tmdb.org/t/p/w92/${service.logo}" alt="${service.name}" class="w-10 h-10 rounded-md object-cover" onerror="this.style.display='none'"><span class="font-medium text-sm">${service.name}</span>`;
        item.addEventListener('click', () => toggleSubscription(service.id));
        subscriptionList.appendChild(item);
    });
}


function renderConfigError(message) {
    $('configErrorScreen').innerHTML = `<div class="config-error-box"><h1>Application Error</h1><p>${message}</p></div>`;
    $('configErrorScreen').classList.remove('hidden');
    $('loginScreen').classList.add('hidden');
    $('app').classList.add('hidden');
}


export {
    applyTheme, initAppUI, refreshCurrentView, renderConfigError,
    showLoading, hideLoading, closeModal, closeSuggestionModal, openSuggestionModal,
    showConfirmationModal, createMediaCard, renderSearchResults, renderLiveSearchResults,
    renderSubscriptions, renderModal, switchTab, renderFavorites,
    renderSchedule, updateUpcomingFilterButtonsUI, renderDashboardUpcoming
};

