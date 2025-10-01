import { initializeAppWithConfig } from './firebase.js';
import { initEventListeners } from './events.js';

/**
 * This is the main entry point for the application.
 * It ensures that the DOM is fully loaded before initializing scripts.
 */
function startApp() {
    // 1. Initialize all event listeners for elements that exist on page load.
    // This is crucial for making the "Sign in with Google" button work immediately.
    initEventListeners();

    // 2. Initialize Firebase, which handles authentication and data loading.
    // This will trigger the onAuthStateChanged listener in firebase.js.
    initializeAppWithConfig();
}

// Wait for the HTML document to be fully parsed before running the app logic.
document.addEventListener('DOMContentLoaded', startApp);

