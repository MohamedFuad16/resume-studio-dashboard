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

export const profileApi = {
  list: () => requestJson('/api/profiles'),
  get: profile => requestJson(`/api/resume?${profilePath(profile)}`),
  save: (profile, resume) => requestJson(`/api/save?${profilePath(profile)}`, { method: 'POST', body: resume }),
  remove: profile => requestJson(`/api/profiles/${encodeURIComponent(profile)}`, { method: 'DELETE' }),
};

export const trackerApi = {
  get: profile => requestJson(`/api/tracker?${profilePath(profile)}`),
  save: (profile, tracker) => requestJson(`/api/tracker?${profilePath(profile)}`, { method: 'POST', body: tracker }),
};

export const internshipApi = {
  list: () => requestJson('/api/internships'),
  add: internship => requestJson('/api/internships', { method: 'POST', body: internship }),
  startResearch: (company, profile) => requestJson('/api/internships/research-company', { method: 'POST', body: { company, profile } }),
  researchStatus: jobId => requestJson(`/api/internships/research-company/${encodeURIComponent(jobId)}`),
};

export const applicationApi = {
  list: profile => requestJson(`/api/applications?${profilePath(profile)}`),
  create: (profile, application) => requestJson(`/api/applications?${profilePath(profile)}`, { method: 'POST', body: application }),
};
