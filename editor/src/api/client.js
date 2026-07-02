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

export const trackerApi = {
  get: profile => (firestoreEnabled() ? fsData.getTracker(profile) : requestJson(`/api/tracker?${profilePath(profile)}`)),
  save: (profile, tracker) => (firestoreEnabled() ? fsData.saveTracker(profile, tracker) : requestJson(`/api/tracker?${profilePath(profile)}`, { method: 'POST', body: tracker })),
};

export const internshipApi = {
  list: () => requestJson('/api/internships'),
  add: internship => requestJson('/api/internships', { method: 'POST', body: internship }),
  startResearch: (company, profile) => requestJson('/api/internships/research-company', { method: 'POST', body: { company, profile } }),
  researchStatus: jobId => requestJson(`/api/internships/research-company/${encodeURIComponent(jobId)}`),
};

export const applicationApi = {
  list: profile => (firestoreEnabled() ? fsData.listApplications(profile) : requestJson(`/api/applications?${profilePath(profile)}`)),
  create: (profile, application) => (firestoreEnabled() ? fsData.createApplication(profile, application) : requestJson(`/api/applications?${profilePath(profile)}`, { method: 'POST', body: application })),
};
