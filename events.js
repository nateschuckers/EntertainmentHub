import { handleGoogleSignIn, handleSignOut, handleDeleteAccount } from './firebase.js';
import { state, saveDataToFirestore } from './state.js';
import { apiFetch } from './api.js';
import { 
    showLoading, 
    hideLoading, 
    renderModal,
    renderLiveSearchResults,
    renderSearchResults, 
    applyTheme,
    openSuggestionModal,
    closeSuggestionModal,
    closeModal
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
    if(!isLiveSearch) showLoading();
    try {
        const data = await apiFetch(`search/multi?query=${query}`);
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
        if(!isLiveSearch) hideLoading();
    }
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

function initEventListeners() {
    document.getElementById('signInWithGoogleButton').addEventListener('click', handleGoogleSignIn);
    
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    searchButton.addEventListener('click', handleFullSearch);
    searchInput.addEventListener('input', handleLiveSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleFullSearch(); });

    document.querySelectorAll('.tab-button').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
    
    document.querySelectorAll('.schedule-view-btn').forEach(btn => btn.addEventListener('click', () => {
        state.scheduleView = btn.dataset.view;
        document.querySelectorAll('.schedule-view-btn').forEach(b => {
            b.classList.toggle('bg-zinc-900', b === btn);
            b.classList.toggle('text-white', b === btn);
            b.classList.toggle('text-zinc-300', b !== btn);
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
        const name = userNameInput.value.trim();
        state.userName = name;
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
        const suggestion = suggestionText.value;
        if(suggestion.trim()) {
            window.location.href = `mailto:nateschuckers@gmail.com?subject=App Suggestion&body=${encodeURIComponent(suggestion)}`;
            suggestionText.value = '';
            closeSuggestionModal();
        }
    });

    setupFavoriteSectionControls('movie');
    setupFavoriteSectionControls('tv');

    document.getElementById('scrollLeftBtn').addEventListener('click', () => { document.getElementById('trendingContainer').scrollBy({ left: -300, behavior: 'smooth' }); });
    document.getElementById('scrollRightBtn').addEventListener('click', () => { document.getElementById('trendingContainer').scrollBy({ left: 300, behavior: 'smooth' }); });
    document.getElementById('scrollUpcomingLeftBtn').addEventListener('click', () => { document.getElementById('upcomingMoviesContainer').scrollBy({ left: -300, behavior: 'smooth' }); });
    document.getElementById('scrollUpcomingRightBtn').addEventListener('click', () => { document.getElementById('upcomingMoviesContainer').scrollBy({ left: 300, behavior: 'smooth' }); });
    document.getElementById('spotlightScrollLeftBtn').addEventListener('click', () => { document.getElementById('spotlightContainer').scrollBy({ left: -300, behavior: 'smooth' }); });
    document.getElementById('spotlightScrollRightBtn').addEventListener('click', () => { document.getElementById('spotlightContainer').scrollBy({ left: 300, behavior: 'smooth' }); });
    document.getElementById('recommendationsScrollLeftBtn').addEventListener('click', () => { document.getElementById('recommendationsContainer').scrollBy({ left: -300, behavior: 'smooth' }); });
    document.getElementById('recommendationsScrollRightBtn').addEventListener('click', () => { document.getElementById('recommendationsContainer').scrollBy({ left: 300, behavior: 'smooth' }); });


    document.getElementById('detailsModal').addEventListener('click', (e) => { if (e.target === document.getElementById('detailsModal')) closeModal(); });
}

function setupFavoriteSectionControls(type) {
    const viewBtns = document.querySelectorAll(`.${type}-fav-view-btn`);
    const manageBtn = document.getElementById(`manage${type === 'movie' ? 'Movies' : 'Tvs'}Btn`);
    const cancelManageBtn = document.getElementById(`cancelManage${type === 'movie' ? 'Movies' : 'Tvs'}Btn`);
    const deleteAllBtn = document.getElementById(`deleteAll${type === 'movie' ? 'Movies' : 'Tvs'}Btn`);
    const deleteSelectedBtn = document.getElementById(`deleteSelected${type === 'movie' ? 'Movies' : 'Tvs'}Btn`);
    const container = document.getElementById(`${type}FavoritesContainer`);

    viewBtns.forEach(btn => btn.addEventListener('click', () => {
        if (type === 'movie') state.movieFavoritesView = btn.dataset.view;
        else state.tvFavoritesView = btn.dataset.view;

        viewBtns.forEach(b => {
            b.classList.toggle('bg-zinc-900', b === btn);
            b.classList.toggle('text-white', b === btn);
            b.classList.toggle('text-zinc-300', b !== btn);
        });
        renderFavorites();
    }));

    manageBtn.addEventListener('click', () => {
        if (type === 'movie') state.isManagingMovies = true;
        else state.isManagingTvs = true;
        renderFavorites();
    });

    cancelManageBtn.addEventListener('click', () => {
        if (type === 'movie') state.isManagingMovies = false;
        else state.isManagingTvs = false;
        renderFavorites();
    });
    
    deleteAllBtn.addEventListener('click', () => {
        showConfirmationModal(`Are you sure you want to remove all favorite ${type === 'movie' ? 'movies' : 'TV shows'}?`, () => {
            state.favorites = state.favorites.filter(fav => fav.media_type !== type);
            saveDataToFirestore();
        });
    });

    deleteSelectedBtn.addEventListener('click', () => {
        const selected = container.querySelectorAll('.favorite-card-manage-checkbox:checked');
        if (selected.length === 0) return;
        const idsToDelete = Array.from(selected).map(el => parseInt(el.value, 10));
        state.favorites = state.favorites.filter(fav => !idsToDelete.includes(fav.id));
        saveDataToFirestore();
    });
}

export { initEventListeners, getMediaDetails };

