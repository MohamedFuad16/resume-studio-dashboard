// Firebase initialization for the Internship Portal.
//
// The web config below is PUBLIC by design — Firebase API keys identify the
// project, they are not secrets. Access is protected by Auth + Firestore
// security rules and the project's authorized-domains list, not by hiding these
// values. See agent/secrets.md. Each field can still be overridden per
// environment via VITE_FIREBASE_* vars (useful for staging or a second project).
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env || {};

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY            || 'AIzaSyDF88ftxi_Ww-10629TX3LHSRqMdzHPrxE',
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN        || 'resume-841f9.firebaseapp.com',
  projectId:         env.VITE_FIREBASE_PROJECT_ID         || 'resume-841f9',
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET     || 'resume-841f9.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '501333131661',
  appId:             env.VITE_FIREBASE_APP_ID             || '1:501333131661:web:15135d8b04c44d1c77fdc4',
  measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID     || 'G-8ZKMD7CZH4',
};

// authAvailable stays true as long as we have an apiKey + projectId. If a future
// deployment blanks the env overrides AND the fallbacks are stripped, the gate
// degrades to the no-auth behavior instead of crashing. Setting
// VITE_AUTH_DISABLED=true also disables the gate — used by the Playwright E2E
// suite (which has no signed-in user) so tests exercise the app shell directly.
const authDisabled = String(env.VITE_AUTH_DISABLED) === 'true';
export const authAvailable = !authDisabled && Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app = authAvailable ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export const googleProvider = new GoogleAuthProvider();
// Always show the account chooser rather than silently reusing the last account.
googleProvider.setCustomParameters({ prompt: 'select_account' });
