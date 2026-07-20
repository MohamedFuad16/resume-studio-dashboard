import { firestoreEnabled } from '../data/firestoreData.js';
import * as fsData from '../data/firestoreData.js';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const apiUrl = path => `${API_BASE}${path}`;

export async function requestJson(path, { body, headers, ...options } = {}) {
  const response = await fetch(apiUrl(path), {
    cache: options.method && options.method !== 'GET' ? undefined : 'no-store',
    ...options,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

const profilePath = profile => `profile=${encodeURIComponent(profile)}`;

// profileApi / trackerApi / applicationApi delegate to Firestore (per-user) when a
// user is signed in, and fall back to the legacy /api/* HTTP backend otherwise
// (no-auth local dev + the E2E suite, which runs with VITE_AUTH_DISABLED=true).
export const profileApi = {
  list: () => (firestoreEnabled() ? fsData.listProfiles() : requestJson('/api/profiles')),
  get: profile => (firestoreEnabled() ? fsData.getProfile(profile) : requestJson(`/api/resume?${profilePath(profile)}`)),
  save: (profile, resume) => (firestoreEnabled() ? fsData.saveProfile(profile, resume) : requestJson(`/api/save?${profilePath(profile)}`, { method: 'POST', body: resume })),
  remove: profile => (firestoreEnabled() ? fsData.removeProfile(profile) : requestJson(`/api/profiles/${encodeURIComponent(profile)}`, { method: 'DELETE' })),
};

// The tracker travels as a DOCUMENT — `{ data, tombstones }` — because the
// deleted-pair tombstone list lives beside the map and is written with it
// (contracts/tracker-record.md "Tombstones").
//
// Firestore stores both fields in one document. The legacy KV route
// (`/api/tracker`) carries only the map: its body shape is a shared contract
// that iOS's Firestore path never touches, and widening it would be a server
// contract change for a path that exists only for no-auth local dev and the E2E
// suite. So on that path tombstones persist in localStorage, per profile — the
// same fallback shape `settingsApi` already uses. It never reaches another
// client, so the two implementations cannot diverge over it.
const LS_TOMBSTONES_KEY = profile => `internship-portal:tombstones:${profile}`;
function localTombstones(profile) {
  try { return JSON.parse(localStorage.getItem(LS_TOMBSTONES_KEY(profile)) || '[]'); } catch { return []; }
}
export const trackerApi = {
  get: profile => (firestoreEnabled()
    ? fsData.getTracker(profile)
    : requestJson(`/api/tracker?${profilePath(profile)}`)
      .then(data => ({ data, tombstones: localTombstones(profile) }))),
  save: (profile, tracker, tombstones = []) => {
    if (firestoreEnabled()) return fsData.saveTracker(profile, tracker, tombstones);
    try { localStorage.setItem(LS_TOMBSTONES_KEY(profile), JSON.stringify(tombstones || [])); } catch { /* ignore */ }
    return requestJson(`/api/tracker?${profilePath(profile)}`, { method: 'POST', body: tracker });
  },
};

export const internshipApi = {
  list: () => requestJson('/api/internships'),
  add: internship => requestJson('/api/internships', { method: 'POST', body: internship }),
  startResearch: (company, profile, extra = {}) => requestJson('/api/internships/research-company', { method: 'POST', body: { company, profile, ...extra } }),
  researchStatus: jobId => requestJson(`/api/internships/research-company/${encodeURIComponent(jobId)}`),
};

export const applicationApi = {
  list: profile => (firestoreEnabled() ? fsData.listApplications(profile) : requestJson(`/api/applications?${profilePath(profile)}`)),
  create: (profile, application) => (firestoreEnabled() ? fsData.createApplication(profile, application) : requestJson(`/api/applications?${profilePath(profile)}`, { method: 'POST', body: application })),
};

// Per-user AI settings (OpenRouter key + model slugs). Stored in Firestore when signed
// in; falls back to localStorage for the no-auth path (no server round-trip needed —
// the key is sent with research/chat requests, see Phase 3).
const LS_SETTINGS_KEY = 'internship-portal:settings';
function localSettings() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS_KEY) || '{}'); } catch { return {}; }
}
export const settingsApi = {
  get: () => (firestoreEnabled()
    ? fsData.getSettings()
    : Promise.resolve(localSettings())),
  save: patch => {
    if (firestoreEnabled()) return fsData.saveSettings(patch);
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify({ ...localSettings(), ...patch }));
    return Promise.resolve({ ok: true });
  },
};
