const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const TRACKER_STATUSES = new Set(['saved', 'applying', 'applied', 'interview', 'rejected']);
const DATA_IMAGE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i;
const PROFILE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
// Tracker KEYS are internship ids, which include Gmail synthetics whose slug can be
// CJK (株式会社カナリー → `gmail-株式会社カナリー`) and catalog ids with dots
// ("live-foo-2026"). The old PROFILE_ID rule rejected CJK and 400'd the ENTIRE
// tracker save (contracts/normalization.md). Allow letters, digits, _ . - and the
// CJK ranges the normalizer keeps, still anchored so path-ish junk fails.
const TRACKER_KEY = /^[A-Za-z0-9_.\-぀-ヿ一-鿿]{1,200}$/u;
// Postal/zip code: optional. Lenient enough for JP (123-4567) and other regions
// (letters/digits/spaces/hyphens). Empty string is allowed (field is optional).
const POSTAL_CODE = /^[0-9A-Za-z][0-9A-Za-z\s-]{0,15}$/;

export class RequestValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'RequestValidationError';
    this.status = status;
  }
}

const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const toPlainJson = value => JSON.parse(JSON.stringify(value ?? null));

function cleanString(value, label, max = 500, required = false) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) throw new RequestValidationError(`${label} is required.`);
  if (text.length > max) throw new RequestValidationError(`${label} is too long.`);
  return text;
}

function cleanHttpsUrl(value, label, required = false) {
  const text = cleanString(value, label, 2048, required);
  if (!text) return '';
  let url;
  try { url = new URL(text); } catch { throw new RequestValidationError(`${label} must be a valid URL.`); }
  if (url.protocol !== 'https:') throw new RequestValidationError(`${label} must use HTTPS.`);
  return url.toString();
}

// Lenient URL sanitizer for INGESTED data (Gmail enrichment can yield an http://
// URL or junk). A bad applyUrl must never 400 the whole tracker save
// (contracts/api.md): upgrade http→https, and if it still won't parse, drop it to
// '' rather than throw. Strict validation stays on user-entered fields.
function sanitizeIngestedUrl(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 2048) return '';
  let url;
  try { url = new URL(text); } catch { return ''; }
  if (url.protocol === 'http:') url.protocol = 'https:';
  return url.protocol === 'https:' ? url.toString() : '';
}

function assertSafeJson(value, path = 'payload', depth = 0, state = { nodes: 0 }) {
  state.nodes += 1;
  if (state.nodes > 12000 || depth > 12) throw new RequestValidationError(`${path} is too complex.`);
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return;
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new RequestValidationError(`${path} contains too many items.`);
    value.forEach((item, index) => assertSafeJson(item, `${path}[${index}]`, depth + 1, state));
    return;
  }
  if (!isRecord(value)) throw new RequestValidationError(`${path} contains an unsupported value.`);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new RequestValidationError(`${path} contains a forbidden key.`);
    assertSafeJson(child, `${path}.${key}`, depth + 1, state);
  }
}

export function validateProfileId(value = 'mohamed_fuad') {
  const id = String(value || 'mohamed_fuad');
  if (!PROFILE_ID.test(id)) throw new RequestValidationError('Invalid profile id.');
  return id;
}

// Internship ids are generated server-side ("live-<slug>-<year>"); this only has to
// reject junk and path-ish input before it reaches the catalog, since the id arrives
// as a URL path segment on DELETE /api/internships/custom/:id.
export function validateInternshipId(value) {
  const id = cleanString(value, 'Internship id', 200, true);
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) throw new RequestValidationError('Invalid internship id.');
  return id;
}

export function validateResume(value) {
  const resume = toPlainJson(value);
  if (!isRecord(resume)) throw new RequestValidationError('Resume must be an object.');
  assertSafeJson(resume, 'resume');
  for (const section of ['education', 'experience', 'projects', 'activities']) {
    if (resume[section] !== undefined && !Array.isArray(resume[section])) {
      throw new RequestValidationError(`${section} must be an array.`);
    }
    if ((resume[section]?.length || 0) > 100) throw new RequestValidationError(`${section} contains too many entries.`);
  }
  const personal = resume.personal || resume.personalInfo || {};
  const photo = personal.photoDataUrl || resume.personalInfo?.photoDataUrl || '';
  if (photo && (photo.length > 8_500_000 || !DATA_IMAGE.test(photo))) {
    throw new RequestValidationError('Profile photo must be a valid PNG, JPEG, or WebP data URL under 6 MB.');
  }
  for (const [key, label] of [['github', 'GitHub URL'], ['linkedin', 'LinkedIn URL']]) {
    if (personal[key]) cleanHttpsUrl(personal[key], label);
  }
  // Optional `personal.postalCode` — normalize on whichever personal block(s) exist
  // (canonical `personal`, plus legacy `personalInfo`). Absent => untouched.
  normalizePostalCode(resume.personal);
  normalizePostalCode(resume.personalInfo);
  return resume;
}

function normalizePostalCode(block) {
  if (!isRecord(block) || block.postalCode === undefined) return;
  const code = cleanString(block.postalCode, 'Postal code', 16);
  if (code && !POSTAL_CODE.test(code)) {
    throw new RequestValidationError('Postal code may only contain letters, numbers, spaces, and hyphens.');
  }
  block.postalCode = code;
}

export function validateTracker(value) {
  const tracker = toPlainJson(value);
  if (!isRecord(tracker)) throw new RequestValidationError('Tracker must be an object.');
  const entries = Object.entries(tracker);
  if (entries.length > 500) throw new RequestValidationError('Tracker contains too many applications.');
  return Object.fromEntries(entries.map(([key, record]) => {
    if (!TRACKER_KEY.test(key) || !isRecord(record)) throw new RequestValidationError('Tracker record is invalid.');
    const status = TRACKER_STATUSES.has(record.status) ? record.status : 'saved';
    const applyUrl = sanitizeIngestedUrl(record.applyUrl);
    // One pass over (at most) the first 100 raw milestones, keeping dated ones —
    // same semantics as slice(0,100).map(...).filter(has date), without 3 passes.
    const milestones = [];
    if (Array.isArray(record.milestones)) {
      const rawCount = Math.min(record.milestones.length, 100);
      for (let i = 0; i < rawCount; i++) {
        const item = record.milestones[i];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(item?.date || '')) continue;
        milestones.push({
          id: cleanString(item?.id, 'Milestone id', 120, true),
          kind: cleanString(item?.kind, 'Milestone kind', 40),
          date: item.date,
          time: /^\d{2}:\d{2}$/.test(item?.time || '') ? item.time : null,
          timeZone: 'Asia/Tokyo',
          title: cleanString(item?.title, 'Milestone title', 300),
          createdAt: cleanString(item?.createdAt, 'Milestone createdAt', 80),
        });
      }
    }
    return [key, {
      ...record,
      internshipId: cleanString(record.internshipId || key, 'Internship id', 120, true),
      company: cleanString(record.company, 'Company', 200),
      role: cleanString(record.role, 'Role', 300),
      location: cleanString(record.location, 'Location', 300),
      deadline: cleanString(record.deadline, 'Deadline', 120),
      applyUrl,
      status,
      milestones,
    }];
  }));
}

export function validateInternship(value) {
  const internship = toPlainJson(value);
  if (!isRecord(internship)) throw new RequestValidationError('Internship must be an object.');
  assertSafeJson(internship, 'internship');
  return {
    ...internship,
    id: cleanString(internship.id, 'Internship id', 120, true).replace(/[^a-zA-Z0-9_-]/g, '-'),
    company: cleanString(internship.company, 'Company', 200, true),
    role: cleanString(internship.role, 'Role', 300, true),
    url: cleanHttpsUrl(internship.url, 'Application URL', true),
    sourceUrl: cleanHttpsUrl(internship.sourceUrl, 'Source URL', true),
    companyUrl: internship.companyUrl ? cleanHttpsUrl(internship.companyUrl, 'Company URL') : '',
    logoUrl: internship.logoUrl ? cleanHttpsUrl(internship.logoUrl, 'Logo URL') : '',
    score: Math.max(0, Math.min(100, Number(internship.score) || 0)),
  };
}

export function validateApplication(value) {
  if (!isRecord(value)) throw new RequestValidationError('Application must be an object.');
  return {
    company: cleanString(value.company, 'Company', 200, true),
    jobTitle: cleanString(value.jobTitle, 'Job title', 300, true),
    jobDescription: cleanString(value.jobDescription, 'Job description', 20_000, true),
    notes: cleanString(value.notes, 'Notes', 10_000),
  };
}

export function sendRequestError(res, error) {
  const status = error instanceof RequestValidationError ? error.status : 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error.' : error.message });
  if (status === 500) console.error(error);
}
