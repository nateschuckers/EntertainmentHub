import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state, loadDataFromFirestore, saveDataToFirestore } from './state.js';
import { applyTheme, initAppUI, refreshCurrentView, renderConfigError } from './ui.js';

let auth, db, userDocRef, unsubscribeUserDoc;
let isDataLoaded = false;
let userId = null;

async function initializeAppWithConfig() {
    try {
        const response = await fetch('/.netlify/functions/get-firebase-config');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server returned status ${response.status}. Response: ${errorText.substring(0, 200)}...`);
        }
        const firebaseConfig = await response.json();
        
        if (!firebaseConfig.apiKey) {
                throw new Error("Received config is missing critical keys. Check Netlify environment variables.");
        }
        runApp(firebaseConfig);

    } catch (error) {
        let errorMessage = error.message;
        if (error instanceof SyntaxError) {
            errorMessage = "The server returned an invalid response (likely HTML instead of JSON). This is a routing issue. Please ensure your netlify.toml redirect rule is correct.";
        }
        renderConfigError(errorMessage);
    }
}

function runApp(firebaseConfig) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, (user) => {
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        isDataLoaded = false;

        if (user) {
            userId = user.uid;
            userDocRef = doc(db, "users", userId);
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            document.getElementById('suggestion-avatar-btn').classList.remove('hidden');
            
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                const wasAlreadyLoaded = isDataLoaded;
                if (docSnap.exists()) {
                    loadDataFromFirestore(docSnap.data());
                } else {
                    if(isDataLoaded) return;
                    saveDataToFirestore();
                    return; 
                }
                
                applyTheme(state.theme);

                if (!wasAlreadyLoaded) {
                   isDataLoaded = true;
                   initAppUI(); 
                } else {
                    refreshCurrentView();
                }
            });
        } else {
            userId = null;
            userDocRef = null;
            applyTheme('default');
            document.getElementById('loginScreen').classList.remove('hidden');
            document.getElementById('app').classList.add('hidden');
            document.getElementById('suggestion-avatar-btn').classList.add('hidden');
            state.favorites = [];
            state.subscriptions = [];
            state.userName = null;
        }
    });

    // Dynamically import and initialize event listeners to prevent circular dependencies
    import('./events.js').then(eventsModule => {
        eventsModule.initEventListeners();
    }).catch(err => console.error("Failed to load event listeners module:", err));
}

function handleGoogleSignIn() {
    const googleProvider = new GoogleAuthProvider();
    signInWithPopup(auth, googleProvider).catch(console.error);
}

function handleSignOut() {
    signOut(auth);
}

async function handleDeleteAccount() {
    if (userDocRef) {
        try {
            await deleteDoc(userDocRef);
            await signOut(auth);
        } catch (e) {
            console.error("Error deleting document: ", e);
        }
    }
}


export { initializeAppWithConfig, auth, db, handleGoogleSignIn, handleSignOut, handleDeleteAccount, userDocRef, userId };

