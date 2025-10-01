import { state } from './state.js';
import { apiFetch } from './api.js';
import { auth, userId, saveDataToFirestore } from './firebase.js';
import { toggleFavorite, toggleSubscription } from './events.js';

const $ = (selector) => document.getElementById(selector);

const themeContent = {
    default: { title: "Entertainment Hub", subtitle: "Find where to watch your favorite shows and movies." },
    horror: { title: "The Overlook", subtitle: "All play and no work makes for a great watchlist." },
    scifi: { title: "Game Over, Man!", subtitle: "Find your next great watch before it's too late." },
    clean: { title: "There Will Be Shows", subtitle: "Find the next series you can really sink your teeth into." }
};

function updateHeaderText(theme) {
    const content = themeContent[theme] || themeContent.default;
    $('loginTitle').textContent = content.title;
    $('mainTitle').textContent = content.title;
    $('mainSubtitle').textContent = content.subtitle;
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
    const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : `https://placehold.co/500x750/374151/FFFFFF?text=No+Image`;
    card.innerHTML = `<img src="${posterUrl}" alt="${title}" class="w-full h-auto object-cover transition-all duration-300"><div class="p-4"><h3 class="font-bold text-md truncate">${title}</h3><p class="text-sm text-zinc-400">${year}</p></div>`;

    if (isManageMode) {
        const overlay = document.createElement('div');
        overlay.className = 'favorite-card-manage-overlay';
        overlay.innerHTML = `<svg class="x-mark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52"><circle cx="26" cy="26" r="25" fill="rgba(239, 68, 68, 0.7)"/><path stroke="white" stroke-width="5" d="M16 16 36 36 M36 16 16 36" /></svg>`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'favorite-card-manage-checkbox';
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
    $('searchResultsMessage').classList.toggle('hidden', validMedia.length > 0);
    $('searchResultsMessage').textContent = 'No results found.';
    validMedia.forEach(item => $('searchResultsContainer').appendChild(createMediaCard(item)));
}

function renderLiveSearchResults(results = []) {
    const liveSearchResults = $('liveSearchResults');
    liveSearchResults.innerHTML = '';
    const validResults = results.filter(item => item.media_type !== 'person' && item.poster_path).slice(0, 5);
    liveSearchResults.classList.toggle('hidden', validResults.length === 0);
    validResults.forEach(item => {
        const el = document.createElement('div');
        el.className = 'flex items-center space-x-3 p-3 hover:bg-zinc-700 cursor-pointer';
        el.innerHTML = `<img src="https://image.tmdb.org/t/p/w92${item.poster_path}" class="w-10 h-auto rounded-md"><span>${item.title || item.name}</span>`;
        el.addEventListener('click', () => {
            getMediaDetails(item.id, item.media_type);
            liveSearchResults.classList.add('hidden');
            $('searchInput').value = '';
        });
        liveSearchResults.appendChild(el);
    });
}

function renderSubscriptions() {
    $('subscriptionList').innerHTML = '';
    state.streamingServices.forEach(service => {
        const isChecked = state.subscriptions.includes(service.id);
        const item = document.createElement('div');
        item.className = `flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition duration-300 ${isChecked ? 'bg-zinc-900' : 'bg-zinc-700'}`;
        item.dataset.serviceId = service.id;
        item.innerHTML = `<img src="https://image.tmdb.org/t/p/w92/${service.logo}" alt="${service.name}" class="w-10 h-10 rounded-md object-cover"><span class="font-medium text-sm">${service.name}</span>`;
        item.addEventListener('click', () => toggleSubscription(service.id));
        $('subscriptionList').appendChild(item);
    });
}

function renderModal(details) {
    const title = details.title || details.name, year = new Date(details.release_date || details.first_air_date).getFullYear() || 'N/A';
    const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'https://placehold.co/500x750/374151/FFFFFF?text=No+Image';
    const isFavorite = state.favorites.some(fav => fav.id === details.id);
    const providers = details['watch/providers']?.results?.US?.flatrate || [];
    let providersHtml = providers.length > 0
        ? providers.map(p => `<div class="flex items-center space-x-2 p-2 rounded ${state.subscriptions.includes(p.provider_id) ? 'bg-green-800' : 'bg-zinc-700'}"><img src="https://image.tmdb.org/t/p/w92${p.logo_path}" class="w-8 h-8 rounded" alt="${p.provider_name}"><span>${p.provider_name} ${state.subscriptions.includes(p.provider_id) ? '<span class="text-xs text-green-300">(Subscribed)</span>' : ''}</span></div>`).join('')
        : '<p class="text-zinc-400">Not available for streaming.</p>';
    
    let manualTimeHtml = '';
    if (details.title ? 'movie' : 'tv' === 'tv' && isFavorite) {
        const favorite = state.favorites.find(f => f.id === details.id);
        manualTimeHtml = `<div class="mt-4 pt-4 border-t border-zinc-700"> ... </div>`; // Simplified for brevity
    }

    $('modalContent').innerHTML = `...`; // Content omitted for brevity, logic is the same
    
    $('favoriteButton').addEventListener('click', () => toggleFavorite(details));
    if ($('editTimeButton')) $('editTimeButton').addEventListener('click', () => editManualTime(details));
    $('detailsModal').classList.remove('hidden');
    $('closeModal').addEventListener('click', closeModal);
}

function updateUpcomingFilterButtonsUI() {
    document.querySelectorAll('.upcoming-filter-btn').forEach(b => {
        const isSelected = b.dataset.filter === state.dashboardScheduleFilter;
        b.classList.toggle('bg-zinc-900', isSelected);
    });
}

async function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    $(tabName)?.classList.remove('hidden');
    document.querySelectorAll('.tab-button').forEach(tab => {
        const isCurrentTab = tab.dataset.tab === tabName;
        tab.classList.toggle('border-zinc-400', isCurrentTab);
        tab.classList.toggle('border-transparent', !isCurrentTab);
    });
    if (tabName === 'dashboard') await fetchDashboardData();
    if (tabName === 'favorites') await renderFavorites();
    if (tabName === 'schedule') { await fetchScheduleData(); renderSchedule(); }
}

async function fetchDashboardData() { /* ... implementation ... */ }
async function renderFavorites() { /* ... implementation ... */ }
async function fetchScheduleData() { /* ... implementation ... */ }
function renderSchedule() { /* ... implementation ... */ }
function showConfirmationModal(message, onConfirm) { /* ... implementation ... */ }
function renderDashboardUpcoming() { /* ... implementation ... */ }

function renderConfigError(message) {
    $('configErrorScreen').innerHTML = `<div class="config-error-box"><h1>Application Error</h1><p>${message}</p></div>`;
    $('configErrorScreen').classList.remove('hidden');
    $('loginScreen').classList.add('hidden');
    $('app').classList.add('hidden');
}

function showLoading() { $('loadingSpinner').classList.remove('hidden'); }
function hideLoading() { $('loadingSpinner').classList.add('hidden'); }
function closeModal() { $('detailsModal').classList.add('hidden'); }
function closeSuggestionModal() { $('suggestionModal').classList.add('hidden'); }

function openSuggestionModal() {
    const content = themeContent[state.theme] || themeContent.default;
    $('suggestionModalTitle').textContent = content.suggestionTitle || "Got a Suggestion?";
    $('suggestionModalSubtitle').textContent = content.suggestionSubtitle || "We'd love to hear it.";
    $('suggestionModal').classList.remove('hidden');
}

function updateAccountSection() {
    const user = auth.currentUser;
    if (user) {
        $('accountSection').innerHTML = `<h2 class="text-2xl font-bold mb-4">Account</h2><p class="text-zinc-400 mb-4">Signed in as ${user.displayName || user.email}</p><button id="signOutButton" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition">Sign Out</button>`;
        $('signOutButton').addEventListener('click', () => import('./firebase.js').then(m => m.handleSignOut()));
        $('deleteAccountBtn').addEventListener('click', () => import('./firebase.js').then(m => m.handleDeleteAccount()));
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
        await fetchDashboardData();
        renderDashboardUpcoming();
    }
    if (state.activeTab === 'favorites') await renderFavorites();
    if (state.activeTab === 'schedule') {
        await fetchScheduleData();
        renderSchedule();
    }
}

export {
    applyTheme, initAppUI, refreshCurrentView, renderConfigError,
    createMediaCard, renderSearchResults, renderLiveSearchResults, renderSubscriptions,
    renderModal, showLoading, hideLoading, closeModal, openSuggestionModal,
    updateAccountSection, switchTab, renderFavorites, renderSchedule,
    updateUpcomingFilterButtonsUI, renderDashboardUpcoming, showConfirmationModal, fetchDashboardData, fetchScheduleData
};

