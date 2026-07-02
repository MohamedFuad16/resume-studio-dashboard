// useAuth — thin React wrapper over Firebase Auth.
//
// Exposes the current user, a loading flag, and the sign-in / sign-up / sign-out
// actions used by LoginScreen and the nav profile menu. All Firebase error codes
// are mapped to short, friendly, bilingual-agnostic messages (the UI adds copy).
import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, authAvailable } from './firebase.js';
import { syncUserDoc } from '../data/userProfile.js';

// Map Firebase error codes to concise messages. Keys are the code suffix.
const ERROR_MESSAGES = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found for that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account already exists for that email.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Allow popups and retry.',
  'auth/network-request-failed': 'Network error. Check your connection and retry.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and retry.',
  'auth/unauthorized-domain': 'This domain is not authorized for sign-in.',
};

function friendlyError(err) {
  const code = err?.code || '';
  return ERROR_MESSAGES[code] || err?.message || 'Something went wrong. Please try again.';
}

// Standalone sign-out for callers that don't need the full hook (e.g. the nav).
export async function signOutUser() {
  if (!authAvailable || !auth) return;
  await fbSignOut(auth);
}

// The currently signed-in user, or null. Handy for one-off reads outside React.
export function currentUser() {
  return auth?.currentUser || null;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(authAvailable);

  useEffect(() => {
    if (!authAvailable || !auth) {
      setLoading(false);
      return undefined;
    }
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
      // Fire-and-forget: keep the Firestore user profile doc fresh on each login.
      if (u) syncUserDoc(u).catch(() => {});
    });
    return unsub;
  }, []);

  const signInEmail = useCallback(async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  }, []);

  const signUpEmail = useCallback(async (email, password, displayName) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
        await syncUserDoc(cred.user).catch(() => {});
      }
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  }, []);

  const signInGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      throw new Error(friendlyError(err));
    }
  }, []);

  return {
    authAvailable,
    user,
    loading,
    signInEmail,
    signUpEmail,
    signInGoogle,
    signOut,
  };
}
