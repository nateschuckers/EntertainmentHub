import { handleGoogleSignIn, saveDataToFirestore } from './firebase.js';
import { state } from './state.js';
import { apiFetch } from './api.js';
import {
    renderLiveSearchResults,
    renderSearchResults,
    applyTheme,
    openSuggestionModal,
    closeSuggestionModal,
    closeModal,
    switchTab,
    renderSchedule,
    updateUpcomingFilterButtonsUI,
    renderDashboardUpcoming,
    renderFavorites,
    showConfirmationModal,
    showLoading,
    hideLoading,
    renderModal
} from './ui.js';

let debounceTimer;

function handleFullSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    document.getElementById('liveSearchResults').classList.add('hidden');
    switchTab('search-results');
    searchMedia(query, false);
}

function handleLiveSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        searchMedia(document.getElementById('searchInput').value.trim(), true);
    }, 300);
}

async function searchMedia(query, isLiveSearch = false) {
    if (!query) {
        document.getElementById('liveSearchResults').classList.add('hidden');
        return;
    }
    if (!isLiveSearch) showLoading();
    try {
        const data = await apiFetch(`search/multi?query=${encodeURIComponent(query)}`);
        if (isLiveSearch) {
            renderLiveSearchResults(data.results);
        } else {
            renderSearchResults(data.results);
        }
    } catch (error) {
        console.error('Search failed:', error);
        if (!isLiveSearch) {
            const searchResultsMessage = document.getElementById('searchResultsMessage');
            searchResultsMessage.textContent = "Search failed. Please try again.";
            searchResultsMessage.classList.remove('hidden');
        }
    } finally {
        if (!isLiveSearch) hideLoading();
    }
}

function toggleSubscription(serviceId) {
    const index = state.subscriptions.indexOf(serviceId);
    if (index > -1) state.subscriptions.splice(index, 1);
    else state.subscriptions.push(serviceId);
    saveDataToFirestore();
}

function toggleFavorite(mediaItem) {
    const index = state.favorites.findIndex(fav => fav.id === mediaItem.id);
    if (index > -1) {
        state.favorites.splice(index, 1);
    } else {
        state.favorites.push({
            id: mediaItem.id,
            name: mediaItem.name || null,
            title: mediaItem.title || null,
            poster_path: mediaItem.poster_path,
            first_air_date: mediaItem.first_air_date || null,
            release_date: mediaItem.release_date || null,
            media_type: mediaItem.title ? 'movie' : 'tv',
            manualTime: null
        });
    }
    saveDataToFirestore();
    renderModal(mediaItem);
}

/**
 * Initializes event listeners for the login screen ONLY.
 */
function initLoginListeners() {
    const signInButton = document.getElementById('signInWithGoogleButton');
    if (signInButton) {
        signInButton.addEventListener('click', handleGoogleSignIn);
    }
}

/**
 * Initializes all event listeners for the main application,
 * to be called AFTER the user has logged in.
 */
function initAppListeners() {
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', handleFullSearch);
        searchInput.addEventListener('input', handleLiveSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleFullSearch();
        });
    }

    document.querySelectorAll('.tab-button').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

    document.querySelectorAll('.schedule-view-btn').forEach(btn => btn.addEventListener('click', () => {
        state.scheduleView = btn.dataset.view;
        document.querySelectorAll('.schedule-view-btn').forEach(b => {
            b.classList.toggle('bg-zinc-900', b === btn);
        });
        renderSchedule();
    }));

    document.querySelectorAll('.upcoming-filter-btn').forEach(btn => btn.addEventListener('click', () => {
        state.dashboardScheduleFilter = btn.dataset.filter;
        updateUpcomingFilterButtonsUI();
        saveDataToFirestore();
        renderDashboardUpcoming();
    }));

    document.getElementById('saveUserNameButton').addEventListener('click', () => {
        const userNameInput = document.getElementById('userNameInput');
        state.userName = userNameInput.value.trim();
        saveDataToFirestore();
        const userNameMessage = document.getElementById('userNameMessage');
        userNameMessage.textContent = 'Name saved!';
        userNameMessage.classList.remove('hidden');
        setTimeout(() => userNameMessage.classList.add('hidden'), 3000);
    });

    document.querySelectorAll('.theme-btn').forEach(btn => btn.addEventListener('click', () => {
        state.theme = btn.dataset.theme;
        applyTheme(state.theme);
        saveDataToFirestore();
    }));

    document.getElementById('suggestion-avatar-btn').addEventListener('click', openSuggestionModal);
    document.getElementById('closeSuggestionModal').addEventListener('click', closeSuggestionModal);
    document.getElementById('suggestionModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('suggestionModal')) closeSuggestionModal();
    });
    document.getElementById('suggestionForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const suggestionText = document.getElementById('suggestionText');
        if (suggestionText.value.trim()) {
            window.location.href = `mailto:nateschuckers@gmail.com?subject=App Suggestion&body=${encodeURIComponent(suggestionText.value)}`;
            suggestionText.value = '';
            closeSuggestionModal();
        }
    });

    setupFavoriteSectionControls('movie');
    setupFavoriteSectionControls('tv');
    
    // Scroll buttons
    document.getElementById('scrollLeftBtn').addEventListener('click', () => { document.getElementById('trendingContainer').scrollBy({ left: -300, behavior: 'smooth' }); });
    document.getElementById('scrollRightBtn').addEventListener('click', () => { document.getElementById('trendingContainer').scrollBy({ left: 300, behavior: 'smooth' }); });
    // ... other scroll listeners

    document.getElementById('detailsModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('detailsModal')) closeModal();
    });
}

function setupFavoriteSectionControls(type) {
    const prefix = type === 'movie' ? 'movie' : 'tv';
    document.querySelectorAll(`.${prefix}-fav-view-btn`).forEach(btn => btn.addEventListener('click', () => {
        state[`${prefix}FavoritesView`] = btn.dataset.view;
        renderFavorites();
    }));

    document.getElementById(`manage${prefix === 'movie' ? 'Movies' : 'Tvs'}Btn`).addEventListener('click', () => {
        state[`isManaging${prefix === 'movie' ? 'Movies' : 'Tvs'}`] = true;
        renderFavorites();
    });
    
    document.getElementById(`cancelManage${prefix === 'movie' ? 'Movies' : 'Tvs'}Btn`).addEventListener('click', () => {
        state[`isManaging${prefix === 'movie' ? 'Movies' : 'Tvs'}`] = false;
        renderFavorites();
    });

    document.getElementById(`deleteAll${prefix === 'movie' ? 'Movies' : 'Tvs'}Btn`).addEventListener('click', () => {
        showConfirmationModal(`Are you sure you want to remove all favorite ${type}s?`, () => {
            state.favorites = state.favorites.filter(fav => fav.media_type !== type);
            saveDataToFirestore();
        });
    });

    document.getElementById(`deleteSelected${prefix === 'movie' ? 'Movies' : 'Tvs'}Btn`).addEventListener('click', () => {
        const container = document.getElementById(`${prefix}FavoritesContainer`);
        const selectedIds = [...container.querySelectorAll(':checked')].map(cb => parseInt(cb.value));
        state.favorites = state.favorites.filter(fav => !selectedIds.includes(fav.id));
        saveDataToFirestore();
    });
}

export { initLoginListeners, initAppListeners, toggleSubscription, toggleFavorite };

