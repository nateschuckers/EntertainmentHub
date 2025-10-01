import { initializeAppWithConfig } from './firebase.js';
import { initLoginListeners } from './events.js';
import { initDom } from './dom.js';

/**
 * This is the main entry point for the application.
 */
function startApp() {
    // 1. Initialize our DOM element cache. This is crucial to ensure
    //    that all scripts have access to the elements they need.
    initDom();

    // 2. Set up the listeners for the login screen.
    initLoginListeners();

    // 3. Initialize Firebase to handle authentication.
    initializeAppWithConfig();
}

// Wait for the HTML document to be fully parsed before running any scripts.
document.addEventListener('DOMContentLoaded', startApp);

