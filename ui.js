import { state } from './state.js';
import { apiFetch } from './api.js';
import { getMediaDetails } from './events.js';
import { auth } from './firebase.js';

const themeContent = {
    default: {
        title: "Entertainment Hub",
        subtitle: "Find where to watch your favorite shows and movies."
    },
    horror: {
        title: "The Overlook",
        subtitle: "All play and no work makes for a great watchlist."
    },
    scifi: {
        title: "Game Over, Man!",
        subtitle: "Find your next great watch before it's too late."
    },
    clean: {
        title: "There Will Be Shows",
        subtitle: "Find the next series you can really sink your teeth into."
    }
};

const $ = (selector) => document.getElementById(selector);

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
    if(theme === 'horror' || theme === 'scifi' || theme === 'clean') {
        document.body.classList.add(`theme-${theme}`);
    }
    
    updateHeaderText(theme);

    document.querySelectorAll('.theme-btn').forEach(btn => {
        const isSelected = btn.dataset.theme === theme;
        btn.classList.toggle('bg-zinc-900', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('bg-zinc-700', !isSelected);
        btn.classList.toggle('text-zinc-300', !isSelected);
    });
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
        overlay.innerHTML = `
            <svg class="x-mark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="25" fill="rgba(239, 68, 68, 0.7)"/>
                <path stroke="white" stroke-width="5" d="M16 16 36 36 M36 16 16 36" />
            </svg>
        `;
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

function renderSearchResults(mediaResults = []) {
    const validMedia = mediaResults.filter(item => item.media_type !== 'person' && item.poster_path);
    $('searchResultsContainer').innerHTML = '';
    $('searchResultsMessage').classList.add('hidden');
    if (validMedia.length === 0) {
        $('searchResultsMessage').textContent = 'No results found.';
        $('searchResultsMessage').classList.remove('hidden');
        return;
    }
    validMedia.forEach(item => $('searchResultsContainer').appendChild(createMediaCard(item)));
}

function renderLiveSearchResults(results = []) {
    const liveSearchResults = $('liveSearchResults');
    liveSearchResults.innerHTML = '';
    const validResults = results.filter(item => item.media_type !== 'person' && item.poster_path).slice(0, 5);
    if (validResults.length === 0) {
        liveSearchResults.classList.add('hidden');
        return;
    }
    validResults.forEach(item => {
        const title = item.title || item.name;
        const el = document.createElement('div');
        el.className = 'flex items-center space-x-3 p-3 hover:bg-zinc-700 cursor-pointer';
        el.innerHTML = `<img src="https://image.tmdb.org/t/p/w92${item.poster_path}" class="w-10 h-auto rounded-md"><span>${title}</span>`;
        el.addEventListener('click', () => {
            getMediaDetails(item.id, item.media_type);
            liveSearchResults.classList.add('hidden');
            $('searchInput').value = '';
        });
        liveSearchResults.appendChild(el);
    });
    liveSearchResults.classList.remove('hidden');
}

function renderSubscriptions() {
    const subscriptionList = $('subscriptionList');
    subscriptionList.innerHTML = '';
    state.streamingServices.forEach(service => {
        const isChecked = state.subscriptions.includes(service.id);
        const logoUrl = `https://image.tmdb.org/t/p/w92/${service.logo}`;
        const item = document.createElement('div');
        item.className = `flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition duration-300`;
        item.classList.toggle('bg-zinc-900', isChecked);
        item.classList.toggle('bg-zinc-700', !isChecked);
        item.dataset.serviceId = service.id;
        item.innerHTML = `<img src="${logoUrl}" alt="${service.name}" class="w-10 h-10 rounded-md object-cover" onerror="this.style.display='none'"><span class="font-medium text-sm">${service.name}</span>`;
        item.addEventListener('click', () => toggleSubscription(service.id));
        subscriptionList.appendChild(item);
    });
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
        let scoreColor = 'bg-zinc-600';
        let borderColor = 'border-zinc-500';
        
        if (score >= 70) {
            scoreColor = 'bg-green-600';
            borderColor = 'border-green-400';
        } else if (score >= 40) {
            scoreColor = 'bg-yellow-600';
            borderColor = 'border-yellow-400';
        } else if (score > 0) {
            scoreColor = 'bg-red-600';
            borderColor = 'border-red-400';
        }

        scoreHtml = `
            <div class="flex items-center space-x-3 mb-4">
                <div class="w-12 h-12 rounded-full flex items-center justify-center ${scoreColor} text-white font-bold text-lg border-2 ${borderColor}">
                    ${score}<span class="text-xs">%</span>
                </div>
                <span class="font-semibold text-lg">User Score</span>
            </div>
        `;
    }
    
    let manualTimeHtml = '';
    if (mediaType === 'tv') {
        const favorite = state.favorites.find(f => f.id === details.id);
        if (favorite) {
            manualTimeHtml = `
                <div class="mt-4 pt-4 border-t border-zinc-700">
                    <h3 class="text-xl font-semibold mb-2">Manual Air Time</h3>
                    <p class="text-zinc-400 text-sm mb-2">Set a time to help sort your schedule (e.g., "9:00 PM EST").</p>
                    <div id="manualTimeContainer" class="flex items-center space-x-4">
                        <p id="manualTimeDisplay" class="text-zinc-300 flex-grow">${favorite.manualTime || 'Not set'}</p>
                        <button id="editTimeButton" class="bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-1 px-3 rounded text-sm">Edit</button>
                    </div>
                </div>`;
        }
    }
    
    $('modalContent').innerHTML = `<button id="closeModal" class="absolute top-4 right-4 text-zinc-400 hover:text-white text-3xl leading-none">&times;</button><div class="flex flex-col md:flex-row gap-6"><div class="md:w-1/3 flex-shrink-0"><img src="${posterUrl}" alt="${title}" class="w-full rounded-lg shadow-md"></div><div class="md:w-2/3"><h2 class="text-3xl font-bold mb-2">${title} (${year})</h2><p class="text-zinc-400 mb-4 text-sm">${details.overview || 'No overview.'}</p>${scoreHtml}<div class="flex gap-4 mb-6"><button id="favoriteButton" class="w-full ${isFavorite ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-700 hover:bg-zinc-600'} text-white font-bold py-2 px-4 rounded transition">${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</button><a href="https://www.themoviedb.org/${mediaType}/${details.id}" target="_blank" rel="noopener noreferrer" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition text-center">See More</a></div><h3 class="text-xl font-semibold mb-2">Watch On:</h3><div class="flex flex-wrap gap-2 mb-6">${providersHtml}</div>${manualTimeHtml}</div></div>`;
    
    const favoriteButton = $('favoriteButton');
    if(favoriteButton) favoriteButton.addEventListener('click', () => toggleFavorite(details));
    
    const editTimeButton = $('editTimeButton');
    if(editTimeButton) editTimeButton.addEventListener('click', () => editManualTime(details));

    $('detailsModal').classList.remove('hidden');
    const closeModalBtn = $('closeModal');
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
}

function renderConfigError(message) {
    const errorScreen = document.getElementById('configErrorScreen');
    errorScreen.innerHTML = `<div class="config-error-box"><h1>Application Error</h1><p>${message}</p></div>`;
    errorScreen.classList.remove('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showLoading() { $('loadingSpinner').classList.remove('hidden'); }
function hideLoading() { $('loadingSpinner').classList.add('hidden'); }
function closeModal() { $('detailsModal').classList.add('hidden'); }
function closeSuggestionModal() { $('suggestionModal').classList.add('hidden'); }

function openSuggestionModal() {
    const title = $('suggestionModalTitle');
    const subtitle = $('suggestionModalSubtitle');
    
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

function updateAccountSection() {
    const user = auth.currentUser;
    if (user) {
        $('accountSection').innerHTML = `<h2 class="text-2xl font-bold mb-4">Account</h2><p class="text-zinc-400 mb-4">Signed in as ${user.displayName || user.email}</p><button id="signOutButton" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition">Sign Out</button>`;
        const signOutButton = $('signOutButton');
        if(signOutButton) signOutButton.addEventListener('click', () => signOut(auth));
        const deleteAccountBtn = $('deleteAccountBtn');
        if(deleteAccountBtn) deleteAccountBtn.addEventListener('click', handleDeleteAccount);
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
    
    if (state.activeTab === 'dashboard') {
        await fetchDashboardData(true);
        renderDashboardUpcoming();
    }
    if (state.activeTab === 'favorites') {
        await renderFavorites();
    }
    if (state.activeTab === 'schedule') { 
        await fetchScheduleData(); 
        renderSchedule(); 
    }
}

export { 
    updateHeaderText, 
    applyTheme,
    createMediaCard,
    renderSearchResults,
    renderLiveSearchResults,
    renderSubscriptions,
    renderModal,
    renderConfigError,
    showLoading,
    hideLoading,
    closeModal,
    closeSuggestionModal,
    openSuggestionModal,
    updateAccountSection,
    initAppUI,
    refreshCurrentView
};

