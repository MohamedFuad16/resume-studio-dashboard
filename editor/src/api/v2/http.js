// HTTP implementation of the v2 data layer: the phase 2 API on EC2. Routes and
// shapes are written down in docs/api-v2.md. Until phase 2 ships these return
// 404, and every screen shows its "not available yet" state.
//
// Phase 2 adds the Firebase ID token to every request (Authorization: Bearer).
import { apiUrl } from '../client.js';
import { parseSearchQuery } from '../../utils/searchQuery.js';
import { masterProfileFromResume, suggestFormat } from '../../documents/tailor.js';

async function call(path, { method = 'GET', body } = {}) {
  const response = await fetch(apiUrl(path), {
    method,
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.headers.get('content-type')?.includes('application/pdf')) {
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.blob();
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

const enc = encodeURIComponent;

export const companyApi = {
  get: (name, { jobType } = {}) => call(`/api/companies/${enc(name)}?jobType=${enc(jobType || '')}`),
};

export const searchApi = {
  // The LLM parser runs server-side; a failure falls back to the local rules so
  // the radar never loses search.
  async parse(query) {
    try {
      return await call('/api/jobs/parse', { method: 'POST', body: { query } });
    } catch {
      return parseSearchQuery(query);
    }
  },
  web: query => call('/api/jobs/search/web', { method: 'POST', body: { query } }),
};

export const documentsApi = {
  master: async resume => {
    try { return await call('/api/documents/master'); } catch { return masterProfileFromResume(resume); }
  },
  suggest: (job, profile) => suggestFormat(job, profile),
  generate: ({ job, lang, kind }) => call('/api/documents/generate', { method: 'POST', body: { job, lang, kind } }),
  list: () => call('/api/documents'),
  save: doc => call(`/api/documents/${enc(doc.id)}`, { method: 'PUT', body: doc }),
  remove: id => call(`/api/documents/${enc(id)}`, { method: 'DELETE' }),
  pdf: async (doc, html) => ({ mode: 'blob', blob: await call('/api/documents/pdf', { method: 'POST', body: { doc, html } }) }),
};

export const mailboxesApi = {
  list: () => call('/api/mailboxes'),
  // Returns { url } for Google's consent screen; the browser goes there.
  add: () => call('/api/mailboxes/auth-url'),
  remove: id => call(`/api/mailboxes/${enc(id)}`, { method: 'DELETE' }),
  syncNow: id => call('/api/mailboxes/sync', { method: 'POST', body: { id: id || null } }),
  getSettings: () => call('/api/mailboxes/settings'),
  saveSettings: patch => call('/api/mailboxes/settings', { method: 'PUT', body: patch }),
};
