import { initializeAppWithConfig } from './firebase.js';
import { initLoginListeners } from './events.js';
import { initUI } from './ui.js';

/**
 * This is the main entry point for the application. It ensures
 * scripts run in the correct order after the page is ready.
 */
function startApp() {
    // Step 1: Find and cache the core HTML elements. This MUST run first.
    initUI();
    
    // Step 2: Set up the listeners for the login screen.
    initLoginListeners();

    // Step 3: Initialize Firebase to handle authentication.
    initializeAppWithConfig();
}

// Wait for the HTML document to be fully loaded before running the app.
document.addEventListener('DOMContentLoaded', startApp);

