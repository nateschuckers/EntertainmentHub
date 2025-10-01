import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state, loadDataFromFirestore } from './state.js';
// We now import screen controls from ui.js instead of touching the DOM directly.
import { applyTheme, initAppUI, refreshCurrentView, renderConfigError, showAppScreen, showLoginScreen } from './ui.js';
import { initAppListeners } from './events.js';

let auth, db, userDocRef, unsubscribeUserDoc;
let isDataLoaded = false;
let userId = null;

const googleProvider = new GoogleAuthProvider();

async function initializeAppWithConfig() {
    try {
        const response = await fetch('/.netlify/functions/get-firebase-config');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status}. Response: ${errorText.substring(0, 200)}...`);
        }
        const firebaseConfig = await response.json();
        
        if (!firebaseConfig.apiKey) {
                throw new Error("Firebase config is missing critical keys.");
        }
        runApp(firebaseConfig);

    } catch (error) {
        renderConfigError(error.message);
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
            showAppScreen(); // Use the safe UI function
            
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
                   initAppListeners();
                } else {
                    refreshCurrentView();
                }
            });
        } else {
            userId = null;
            userDocRef = null;
            applyTheme('default');
            showLoginScreen(); // Use the safe UI function
            state.favorites = [];
            state.subscriptions = [];
            state.userName = null;
        }
    });
}

async function saveDataToFirestore() {
    if (!userDocRef) return;
    const dataToSave = {
        userName: state.userName,
        subscriptions: state.subscriptions,
        favorites: state.favorites,
        theme: state.theme,
        dashboardScheduleFilter: state.dashboardScheduleFilter
    };
    try {
        await setDoc(userDocRef, dataToSave, { merge: true });
    } catch (e) {
        console.error("Error writing document: ", e);
    }
}


function handleGoogleSignIn() {
    if (auth) {
        signInWithPopup(auth, googleProvider).catch(console.error);
    } else {
        console.error("Firebase Auth is not initialized yet.");
    }
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

export { initializeAppWithConfig, auth, db, handleGoogleSignIn, handleSignOut, handleDeleteAccount, userDocRef, userId, saveDataToFirestore };

