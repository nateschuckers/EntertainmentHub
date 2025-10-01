/**
 * A centralized utility for accessing and managing DOM elements.
 * This ensures that we don't try to access an element before it exists.
 */

// Cache the DOM elements to avoid repeated lookups.
const elements = {
    loginScreen: null,
    app: null,
    suggestionAvatar: null,
};

/**
 * Initializes the DOM element cache. This should be called once the
 * DOM is fully loaded.
 */
function initDom() {
    elements.loginScreen = document.getElementById('loginScreen');
    elements.app = document.getElementById('app');
    elements.suggestionAvatar = document.getElementById('suggestion-avatar-btn');
}

/**
 * Toggles the visibility of the main application and the login screen.
 * @param {boolean} showApp - If true, shows the app; otherwise, shows the login screen.
 */
function toggleAppVisibility(showApp) {
    if (elements.loginScreen && elements.app && elements.suggestionAvatar) {
        elements.loginScreen.classList.toggle('hidden', showApp);
        elements.app.classList.toggle('hidden', !showApp);
        elements.suggestionAvatar.classList.toggle('hidden', !showApp);
    } else {
        console.error("DOM elements not initialized. Call initDom() first.");
    }
}

export { initDom, toggleAppVisibility };
