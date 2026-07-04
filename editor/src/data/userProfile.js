// Firestore user-profile scaffold.
//
// This is the first real read/write against Firestore. On each login we upsert a
// `users/{uid}` document with the account's basic identity + a login timestamp.
// Security rules (firestore.rules) allow a user to read/write ONLY their own doc.
//
// NOTE (scope): the app's résumé / tracker / application data still lives in the
// existing sql.js + Vercel Blob KV backend. Migrating that into per-user
// Firestore collections is deliberately out of scope for this pass — see
// agent/decisions.md ADR for the auth-gate-first decision. New per-user
// collections (e.g. users/{uid}/resume) should hang off this same document.
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, authAvailable } from '../auth/firebase.js';

export function userDocRef(uid) {
  return doc(db, 'users', uid);
}

// Create-or-update the signed-in user's profile document. Idempotent: sets
// createdAt only on first write, always refreshes identity + lastLoginAt.
export async function syncUserDoc(user) {
  if (!authAvailable || !db || !user) return;
  const ref = userDocRef(user.uid);
  const snap = await getDoc(ref);
  const base = {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    providers: (user.providerData || []).map(p => p.providerId),
    lastLoginAt: serverTimestamp(),
  };
  if (!snap.exists()) base.createdAt = serverTimestamp();
  await setDoc(ref, base, { merge: true });
}

export async function getUserDoc(uid) {
  if (!authAvailable || !db || !uid) return null;
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? snap.data() : null;
}
