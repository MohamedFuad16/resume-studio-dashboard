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

// ── tracker (whole-blob per profile) ──────────────────────────────
export async function getTracker(id) {
  const snap = await getDoc(trackerDoc(id));
  return snap.exists() ? (snap.data().data || {}) : {};
}

export async function saveTracker(id, tracker) {
  await setDoc(trackerDoc(id), { data: tracker || {}, updatedAt: serverTimestamp() });
  return { ok: true };
}

// ── applications (whole array per profile; cover letter built server-side) ──
export async function listApplications(id) {
  const snap = await getDoc(appsDoc(id));
  return snap.exists() ? (snap.data().items || []) : [];
}

export async function createApplication(id, application) {
  const resume = await getProfile(id);
  const built = await serverJson('/api/cover-letter', {
    method: 'POST',
    body: JSON.stringify({ resume, ...application }),
  });
  const record = {
    fileName: built.fileName,
    company: application.company,
    jobTitle: application.jobTitle,
    dateLogged: new Date().toISOString().slice(0, 10),
    status: 'Applied / Logged via Web UI',
    jobDescription: application.jobDescription,
    notes: application.notes,
    coverLetter: built.coverLetter,
  };
  const existing = await listApplications(id);
  const next = [record, ...existing.filter(item => item.fileName !== record.fileName)];
  await setDoc(appsDoc(id), { items: next, updatedAt: serverTimestamp() });
  return { success: true, ...record };
}

// ── per-user settings (AI keys + models) ─────────────────────────
// Stored at users/{uid}/settings/app. The OpenRouter key lives here (secured by the
// owner-only rules) and is sent with research/chat requests (Phase 3), since the
// server has no Admin SDK to read Firestore.
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
