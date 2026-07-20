// Firestore-backed data provider (client-direct).
//
// Mirrors the HTTP data API (profileApi / trackerApi / applicationApi in
// api/client.js) but reads/writes the signed-in user's own data under
// users/{uid}/... , secured by the deployed owner-only rules. api/client.js
// delegates to this module when a user is signed in; otherwise it uses the
// legacy /api/* HTTP backend (kept for the no-auth / E2E path).
//
// Data model (per user):
//   users/{uid}/profiles/{profileId}    { name, resume, createdAt, updatedAt }
//   users/{uid}/trackers/{profileId}    { data: <tracker map>, updatedAt }
//   users/{uid}/applications/{profileId}{ items: [<application>], updatedAt }
//
// The global internship catalog + live research + LaTeX compile/export stay on
// the Express server (see agent/decisions.md ADR). Custom researched companies
// remain server-global for now (documented limitation).
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth, authAvailable } from '../auth/firebase.js';

// Accounts that should be seeded from the existing `mohamed_fuad` sample on first
// login (keeps profile id 'mohamed_fuad' so the ranking map + defaults align).
const OWNER_EMAILS = String(import.meta.env?.VITE_OWNER_EMAILS || 'flashxjapan@gmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const OWNER_SEED_PROFILE = 'mohamed_fuad';
const DEFAULT_PROFILE_ID = 'primary';

const STARTER_RESUME = {
  personal: { nameEn: '', nameJa: '', email: '', phone: '', address: '', postalCode: '' },
  summary: '', summaryEn: '', summaryJa: '',
  education: [], experience: [], projects: [], skills: [], activities: [],
  japanese: { summary: '' },
};

const API_BASE = import.meta.env?.VITE_API_BASE_URL || '';
async function serverJson(path, options) {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...options,
    headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), ...(options?.headers || {}) } });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
  return payload;
}

export function firestoreEnabled() {
  return Boolean(authAvailable && db && auth?.currentUser);
}

function uid() {
  const id = auth?.currentUser?.uid;
  if (!id) throw new Error('Not signed in.');
  return id;
}
const profilesCol = () => collection(db, 'users', uid(), 'profiles');
const profileDoc = id => doc(db, 'users', uid(), 'profiles', id);
const trackerDoc = id => doc(db, 'users', uid(), 'trackers', id);
const appsDoc = id => doc(db, 'users', uid(), 'applications', id);
const settingsDoc = () => doc(db, 'users', uid(), 'settings', 'app');

function deriveName(resume, fallback) {
  return resume?.personal?.nameEn || resume?.personal?.nameJa || fallback;
}

// ── profiles ──────────────────────────────────────────────────────
export async function listProfiles() {
  const snap = await getDocs(profilesCol());
  return snap.docs
    .map(d => ({ id: d.id, name: d.data().name || d.id, fileName: `${d.id}.json` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProfile(id) {
  const snap = await getDoc(profileDoc(id));
  if (!snap.exists()) {
    const err = new Error('Profile not found.');
    err.code = 'ENOENT';
    throw err;
  }
  return snap.data().resume || {};
}

export async function saveProfile(id, resume) {
  const ref = profileDoc(id);
  const existed = (await getDoc(ref)).exists();
  const payload = { name: deriveName(resume, id), resume, updatedAt: serverTimestamp() };
  if (!existed) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  return { ok: true };
}

export async function removeProfile(id) {
  await deleteDoc(profileDoc(id));
  await Promise.allSettled([deleteDoc(trackerDoc(id)), deleteDoc(appsDoc(id))]);
  return { ok: true, success: true };
}

// Deletes every document this account owns: each profile plus its tracker and
// applications. Used by account deletion, which must clear Firestore BEFORE the
// auth user goes away — the security rules key on request.auth.uid, so once the
// user is deleted these documents can never be reached or removed again.
// Throws if any profile fails to delete, so the caller does not proceed to delete
// the auth user and strand data.
export async function removeAllUserData() {
  const profiles = await listProfiles();
  const results = await Promise.allSettled(profiles.map(p => removeProfile(p.id)));
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) {
    throw new Error(
      `Could not delete ${failed.length} of ${profiles.length} profiles: ${failed[0].reason?.message || 'unknown error'}`
    );
  }
  return { ok: true, deleted: profiles.length };
}

// ── tracker (whole-blob per profile) ──────────────────────────────
// The document holds BOTH the tracker map and the per-profile tombstone list —
// deleted (companyKey, roleKey) pairs a Gmail drain must never re-create:
//
//   users/{uid}/trackers/{profileId} { data: <tracker map>, tombstones: [...] }
//
// The path is fixed by contracts/tracker-record.md ("User truth outranks the
// pipeline") and iOS reads the same document, so the field name is load-bearing.
// One `setDoc` writes both: a deletion that persisted the record removal but not
// its tombstone would be undone by the next drain.
export async function getTracker(id) {
  const snap = await getDoc(trackerDoc(id));
  if (!snap.exists()) return { data: {}, tombstones: [] };
  const doc = snap.data();
  return { data: doc.data || {}, tombstones: Array.isArray(doc.tombstones) ? doc.tombstones : [] };
}

export async function saveTracker(id, tracker, tombstones = []) {
  await setDoc(trackerDoc(id), {
    data: tracker || {},
    tombstones: Array.isArray(tombstones) ? tombstones : [],
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

// ── applications (whole array per profile; cover letter built server-side) ──
export async function getSettings() {
  const snap = await getDoc(settingsDoc());
  return snap.exists() ? snap.data() : {};
}

export async function saveSettings(patch) {
  await setDoc(settingsDoc(), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  return { ok: true };
}

// ── first-login seed ──────────────────────────────────────────────
// Ensures a signed-in user has at least one profile. Owner accounts are seeded
// from the existing mohamed_fuad sample (profile + tracker) so nothing is lost;
// everyone else gets a blank starter profile. Idempotent.
export async function ensureSeed(user) {
  if (!firestoreEnabled() || !user) return;
  const existing = await getDocs(profilesCol());
  if (!existing.empty) return;

  const isOwner = OWNER_EMAILS.includes((user.email || '').toLowerCase());
  if (isOwner) {
    try {
      const [seedResume, seedTracker] = await Promise.all([
        serverJson(`/api/resume?profile=${OWNER_SEED_PROFILE}`),
        serverJson(`/api/tracker?profile=${OWNER_SEED_PROFILE}`).catch(() => ({})),
      ]);
      await saveProfile(OWNER_SEED_PROFILE, seedResume);
      if (seedTracker && typeof seedTracker === 'object') {
        await saveTracker(OWNER_SEED_PROFILE, seedTracker);
      }
      return;
    } catch {
      // Fall through to a blank profile if the seed source is unreachable.
    }
  }
  const starter = { ...STARTER_RESUME, personal: { ...STARTER_RESUME.personal, nameEn: user.displayName || '', email: user.email || '' } };
  await saveProfile(DEFAULT_PROFILE_ID, starter);
}
