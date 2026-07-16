/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0660394308",
  appId: "1:530131002224:web:c0a522a43fc7168d4c25b5",
  apiKey: "AIzaSyC0vBoHInzBR0E1rpq9HGCLweL_ExY6aYM",
  authDomain: "gen-lang-client-0660394308.firebaseapp.com",
  storageBucket: "gen-lang-client-0660394308.firebasestorage.app",
  messagingSenderId: "530131002224",
  measurementId: "",
  oAuthClientId: "530131002224-u0b9l2ku41kjntup4ra0je5emd1elole.apps.googleusercontent.com"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Workspace scopes for Google Drive and Google Sheets
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Load cached token from temporary session cache to survive page refreshes
try {
  const sessToken = localStorage.getItem('g_oauth_token');
  if (sessToken) {
    cachedAccessToken = sessToken;
  }
} catch (e) {
  console.warn('localStorage is not available:', e);
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Try to retrieve token, or let client handle signing in again
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      try {
        localStorage.removeItem('g_oauth_token');
      } catch (e) {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem('g_oauth_token', cachedAccessToken);
    } catch (e) {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  try {
    localStorage.removeItem('g_oauth_token');
  } catch (e) {}
};
