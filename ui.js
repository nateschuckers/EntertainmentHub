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
    // ... (implementation unchanged)
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
    // ... (implementation unchanged)
    $('detailsModal').classList.remove('hidden');
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
    // ... (implementation unchanged)
    const cardWrapper = document.createElement('div');
    // ...
    return cardWrapper;
}


// --- Search ---

function renderSearchResults(mediaResults = []) {
    // ... (implementation unchanged)
}

function renderLiveSearchResults(results = []) {
    // ... (implementation unchanged)
}


// --- App Initialization & Page Switching ---

async function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    const tabEl = $(tabName);
    if (tabEl) tabEl.classList.remove('hidden');
    
    document.querySelectorAll('.tab-button').forEach(tab => {
        const isCurrentTab = tab.dataset.tab === tabName;
        tab.classList.toggle('text-zinc-400', isCurrentTab);
        tab.classList.toggle('border-zinc-400', isCurrentTab);
        tab.classList.toggle('font-medium', isCurrentTab);
        tab.classList.toggle('text-zinc-500', !isCurrentTab);
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
    
    if (state.activeTab === 'dashboard') {
        await fetchDashboardData();
    }
    if (state.activeTab === 'favorites') {
        await renderFavorites();
    }
    if (state.activeTab === 'schedule') { 
        await fetchScheduleData(); 
        renderSchedule(); 
    }
}


// --- Dashboard ---

async function fetchDashboardData() {
    showLoading();
    try {
        $('dashboardUserName').textContent = state.userName || 'You';
        const trendingPromise = apiFetch(`trending/all/day`);
        const upcomingPromise = apiFetch(`movie/upcoming`);
        const [trendingData, upcomingData] = await Promise.all([trendingPromise, upcomingPromise, fetchScheduleData(true)]);
        
        // Render functions would be here...
        renderDashboardUpcoming();

    } catch (error) {
        console.error("Failed to load dashboard:", error);
    } finally {
        hideLoading();
    }
}

function updateUpcomingFilterButtonsUI() {
    document.querySelectorAll('.upcoming-filter-btn').forEach(b => {
        const isSelected = b.dataset.filter === state.dashboardScheduleFilter;
        b.classList.toggle('bg-zinc-900', isSelected);
    });
}

function renderDashboardUpcoming() {
    // ... (implementation unchanged)
}

// --- Favorites ---

async function renderFavorites() {
    // ... (implementation unchanged)
}

// --- Schedule ---

async function fetchScheduleData(isDashboard = false) {
    // ... (implementation unchanged)
}

function renderSchedule() {
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
    // ... (implementation unchanged)
}

function renderAgenda() {
    // ... (implementation unchanged)
}

// --- Settings ---

function renderSubscriptions() {
    // ... (implementation unchanged)
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

