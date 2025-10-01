import { initializeAppWithConfig } from './firebase.js';
import { initLoginListeners } from './events.js';

/**
 * This is the main entry point for the application.
 * It ensures that the DOM is fully loaded before initializing scripts.
 */
function startApp() {
    // 1. Initialize only the listeners needed for the login screen.
    // This makes the "Sign in with Google" button work immediately.
    initLoginListeners();

    // 2. Initialize Firebase, which handles authentication. The authentication
    // process will then trigger the setup for the rest of the app.
    initializeAppWithConfig();
}

// Wait for the HTML document to be fully parsed before running the app logic.
document.addEventListener('DOMContentLoaded', startApp);

