import './load-env.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { researchCompanyInternships } from './internship-research.js';
import { createStore } from './storage.js';
import {
  INTERNSHIP_RESEARCH_DATE,
  INTERNSHIP_RESEARCH_NOTE,
  internshipStats as seedInternshipStats,
} from './seeds/internships.js';
import { buildSeedCatalog } from './seeds/catalog.js';
import { isRetiredInternshipId } from './seeds/catalog-audit-2026-07-02.js';
import { autoRefreshData } from './seeds/auto-refresh.js';
import * as gmailOAuth from './gmail/oauth.js';
import * as gmailStore from './gmail/store.js';
import { encAvailable } from './gmail/crypto.js';
import { syncProfile } from './gmail/sync.js';
import {
  sendRequestError,
  validateInternship,
  validateInternshipId,
  validateProfileId,
  validateResume,
  validateTracker,
} from './validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_ROOT = path.resolve(__dirname, '../../');
const DATA_FILE = path.join(RESUME_ROOT, 'editor', 'resume.json');
const PROFILES_DIR = path.join(__dirname, 'profiles');
const CUSTOM_INTERNSHIPS_FILE = path.join(__dirname, 'custom-internships.json');
const DATA_DIR = process.env.RESUME_STUDIO_DATA_DIR || path.join(__dirname, '.data');
const store = createStore({ localDbPath: path.join(DATA_DIR, 'resume-studio.sqlite') });
const internshipResearchJobs = new Map();
const internshipResearchByCompany = new Map();
const RESEARCH_CACHE_MS = 15 * 60 * 1000;

// Primary profile used as the read/write fallback everywhere a profile id is omitted.
const DEFAULT_PROFILE_ID = process.env.RESUME_DEFAULT_PROFILE_ID || 'mohamed_fuad';
// Sample profiles shipped as JSON in server/profiles and force-seeded on boot so a
// fresh store always lists demo data. Each is only seeded when its KV key is missing
// and its <id>.json file exists (see ensureSampleProfiles / readProfile).
const SAMPLE_PROFILE_IDS = ['mohamed_fuad', 'aiko_tanaka'];
// Profile ids that were removed and must never resurface. Their KV keys are purged on
// boot (see purgeRetiredProfiles) and excluded from listProfiles defensively. `temp`
// was the scratch profile (nameEn "fdf"); its <id>.json is gone but the KV row lingered
// locally and in the prod Blob snapshot. See BUG-008.
const RETIRED_PROFILE_IDS = ['temp'];
// Profiles the DELETE route refuses to remove. Configurable via env (comma-separated);
// defaults to protecting only the primary profile.
const PROTECTED_PROFILE_IDS = new Set(
  (process.env.RESUME_PROTECTED_PROFILE_IDS || DEFAULT_PROFILE_ID)
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
);

const sanitizeProfileId = value => String(value || DEFAULT_PROFILE_ID).replace(/[^a-zA-Z0-9_-]/g, '') || DEFAULT_PROFILE_ID;
const profileKey = id => `profile:${sanitizeProfileId(id)}`;
const trackerKey = id => `tracker:${sanitizeProfileId(id)}`;
const applicationsKey = id => `applications:${sanitizeProfileId(id)}`;
const INTERNSHIP_CATALOG_KEY = 'internships:catalog';

function mergeInternships(...groups) {
  const byId = new Map();
  for (const item of groups.flat()) {
    if (!item?.id || byId.has(item.id)) continue;
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

// In-process memo for the resolved catalog. Without it, every /api/internships
// request rebuilt + re-validated the full seed catalog and double-JSON.stringified
// it against the stored copy (a ~1 MB drift check). All writes go through
// writeInternshipCatalog / the setJson calls below, which refresh the memo; the
// short TTL bounds staleness across instances on multi-instance hosts (Vercel).
const CATALOG_MEMO_MS = 60_000;
let catalogMemo = null;
let catalogMemoAt = 0;

function rememberCatalog(catalog) {
  catalogMemo = catalog;
  catalogMemoAt = Date.now();
  return catalog;
}

async function readInternshipCatalog() {
  if (catalogMemo && Date.now() - catalogMemoAt < CATALOG_MEMO_MS) return catalogMemo;
  const stored = await store.getJson(INTERNSHIP_CATALOG_KEY, null);
  const seedCatalog = buildSeedCatalog().map(validateInternship);
  if (Array.isArray(stored) && stored.length) {
    const seedIds = new Set(seedCatalog.map(item => item.id));
    // One pass over `stored` sorts every entry into its bucket (or drops it).
    const liveResearch = [];
    const nonSeedStored = [];
    for (const item of stored) {
      if (isRetiredInternshipId(item?.id)) continue;
      if (item?.prestigeTier === 'Live company research') liveResearch.push(validateInternship(item));
      else if (!seedIds.has(item?.id)) nonSeedStored.push(validateInternship(item));
    }
    const catalog = mergeInternships(liveResearch, seedCatalog, nonSeedStored);
    if (catalog.length !== stored.length || JSON.stringify(catalog) !== JSON.stringify(stored)) {
      await store.setJson(INTERNSHIP_CATALOG_KEY, catalog);
    }
    return rememberCatalog(catalog);
  }
  const legacyCustom = await store.getJson('customInternships', []);
  const legacyValidated = [];
  if (Array.isArray(legacyCustom)) {
    for (const item of legacyCustom) {
      if (!isRetiredInternshipId(item?.id)) legacyValidated.push(validateInternship(item));
    }
  }
  const catalog = mergeInternships(legacyValidated, seedCatalog);
  await store.setJson(INTERNSHIP_CATALOG_KEY, catalog);
  return rememberCatalog(catalog);
}

async function writeInternshipCatalog(items) {
  const surviving = [];
  for (const item of items) {
    if (!isRetiredInternshipId(item?.id)) surviving.push(validateInternship(item));
  }
  const catalog = mergeInternships(surviving);
  await store.setJson(INTERNSHIP_CATALOG_KEY, catalog);
  return rememberCatalog(catalog);
}

function internshipCatalogMeta(items) {
  const verifiedDates = [];
  for (const item of items) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.verifiedDate || '')) verifiedDates.push(item.verifiedDate);
  }
  verifiedDates.sort();
  // The auto-refresh overlay liveness-checks the WHOLE catalog on each run, so
  // its updatedAt is the honest "checked <date>" — usually newer than the last
  // per-listing verifiedDate (which only moves when a listing is re-researched).
  const lastChecked = String(autoRefreshData.updatedAt || '').slice(0, 10);
  return {
    target: Math.max(seedInternshipStats.target || 200, items.length),
    researchDate: verifiedDates.at(-1) || INTERNSHIP_RESEARCH_DATE,
    lastCheckedDate: /^\d{4}-\d{2}-\d{2}$/.test(lastChecked) ? lastChecked : '',
    researchNote: INTERNSHIP_RESEARCH_NOTE,
    count: items.length,
  };
}

async function readCustomInternships() {
  const catalog = await readInternshipCatalog();
  return catalog.filter(item => item.prestigeTier === 'Live company research');
}

async function writeCustomInternships(items) {
  const catalog = await readInternshipCatalog();
  const activeItems = items.filter(item => !isRetiredInternshipId(item?.id));
  const customIds = new Set(activeItems.map(item => item.id));
  const next = mergeInternships(activeItems, catalog.filter(item => item.prestigeTier !== 'Live company research' && !customIds.has(item.id)));
  await writeInternshipCatalog(next);
  await store.setJson('customInternships', activeItems.map(validateInternship));
  if (!process.env.VERCEL) {
    await fs.writeFile(CUSTOM_INTERNSHIPS_FILE, `${JSON.stringify(activeItems, null, 2)}\n`, 'utf8');
  }
}

async function readProfile(profileId = DEFAULT_PROFILE_ID) {
  const id = sanitizeProfileId(profileId);
  const stored = await store.getJson(profileKey(id), null);
  if (stored) return stored;
  const file = path.join(PROFILES_DIR, `${id}.json`);
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    await store.setJson(profileKey(id), parsed);
    return parsed;
  } catch {
    if (id === DEFAULT_PROFILE_ID) {
      let defaultData;
      try {
        defaultData = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
      } catch {
        defaultData = createEmptyResume();
      }
      await store.setJson(profileKey(id), defaultData);
      return defaultData;
    }
    return createEmptyResume();
  }
}

async function writeProfile(profileId, data) {
  const id = validateProfileId(profileId);
  const safeData = validateResume(data);
  await store.setJson(profileKey(id), safeData);
  if (!process.env.VERCEL) {
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    await fs.writeFile(path.join(PROFILES_DIR, `${id}.json`), JSON.stringify(safeData, null, 2), 'utf8');
  }
}

async function listProfiles() {
  const stored = await store.listJson('profile:');
  if (stored.length) {
    const profiles = [];
    for (const { key, value } of stored) {
      const id = key.replace(/^profile:/, '');
      if (RETIRED_PROFILE_IDS.includes(id)) continue;
      profiles.push({ id, name: value.personal?.nameEn || value.personalInfo?.fullName || id, fileName: `${id}.json` });
    }
    return profiles;
  }
  await ensureSampleProfiles();
  return listProfiles();
}

// Force-seed each shipped sample profile whose KV key is missing but whose
// <id>.json file exists. Idempotent: readProfile returns stored data untouched
// when present and only writes to the store when seeding from disk.
async function ensureSampleProfiles() {
  // Each sample seeds its own independent profile:<id> key — safe in parallel.
  await Promise.all(SAMPLE_PROFILE_IDS.map(sampleId => readProfile(sampleId)));
}

// Delete the KV rows for any retired profile ids (profile:/tracker:/applications:).
// Idempotent — safe to run on every boot; rewrites the Blob snapshot so prod is cleaned
// on the next deploy. See BUG-008.
async function purgeRetiredProfiles() {
  // Independent keys; failures are individually swallowed, so run them together.
  await Promise.all(RETIRED_PROFILE_IDS.flatMap(id => [
    store.deleteKey(profileKey(id)).catch(() => {}),
    store.deleteKey(trackerKey(id)).catch(() => {}),
    store.deleteKey(applicationsKey(id)).catch(() => {}),
  ]));
}

async function deleteProfile(profileId) {
  const id = validateProfileId(profileId);
  await store.deleteKey(profileKey(id));
  await store.deleteKey(trackerKey(id));
  await store.deleteKey(applicationsKey(id)); // legacy cover-letter log, if any
  if (!process.env.VERCEL) {
    await fs.unlink(path.join(PROFILES_DIR, `${id}.json`)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

// ── Initialize durable store and migrate existing local JSON data ───
async function initPersistentStore() {
  try {
    await store.init();
    await fs.mkdir(PROFILES_DIR, { recursive: true }).catch(() => {});
    const migrated = await store.listJson('profile:');
    if (!migrated.length) {
      try {
        const files = await fs.readdir(PROFILES_DIR);
        // Each profile file migrates to its own key — independent, run together.
        const migrations = [];
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          const id = file.replace(/\.json$/, '');
          migrations.push(fs.readFile(path.join(PROFILES_DIR, file), 'utf8')
            .then(raw => store.setJson(profileKey(id), JSON.parse(raw))));
        }
        await Promise.all(migrations);
      } catch (error) {
        if (error.code !== 'ENOENT') console.error('Could not migrate profile files:', error.message);
      }
    }
    await purgeRetiredProfiles();
    await ensureSampleProfiles();
    await readInternshipCatalog();
    console.log(`✅ Internship Portal store ready (${store.backend})`);
  } catch (e) {
    console.error('Error initializing persistence:', e);
  }
}
initPersistentStore();


const app = express();
const PORT = process.env.PORT || 5005;

const trustedOrigins = new Set([
  process.env.RESUME_STUDIO_APP_ORIGIN,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
  'https://editor-omega-two.vercel.app',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
].filter(Boolean));
const isTrustedOrigin = origin => !origin || trustedOrigins.has(origin);
function setNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Surrogate-Control', 'no-store');
}

app.use(cors({
  origin(origin, callback) {
    callback(isTrustedOrigin(origin) ? null : new Error('Origin not allowed'), isTrustedOrigin(origin));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '12mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isTrustedOrigin(req.get('origin'))) {
    return res.status(403).json({ error: 'Cross-origin write rejected.' });
  }
  next();
});
app.use('/api', (req, res, next) => {
  setNoStore(res);
  next();
});



// Reports whether writes actually survive a restart, by checking the filesystem
// rather than trusting a label. The previous version compared `store.backend` to
// the string 'local-sqlite', which says nothing about durability: it reported
// persistent:true for months while the container wrote to its ephemeral image
// layer and lost every live-research result on each restart (BUG-011, ADR-0032).
async function describePersistence() {
  // Outside a container the data dir is a real disk, so it survives a restart.
  const containerized = Boolean(
    process.env.CONTAINER_APP_NAME || process.env.VERCEL || process.env.KUBERNETES_SERVICE_HOST
  );
  if (!containerized) return { persistent: true, reason: 'local-disk' };

  // Inside a container the app directory lives on the ephemeral image layer. A
  // mounted volume is a separate filesystem, so a differing st_dev proves the
  // data dir is NOT that layer — this is what actually distinguishes the two.
  try {
    const [dataStat, appStat] = await Promise.all([fs.stat(DATA_DIR), fs.stat(__dirname)]);
    if (dataStat.dev !== appStat.dev) return { persistent: true, reason: 'mounted-volume' };
    return { persistent: false, reason: 'ephemeral-container-disk' };
  } catch (error) {
    return { persistent: false, reason: `data-dir-unreadable: ${error.code || error.message}` };
  }
}

// ── GET /api/status ──────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  try {
    await store.init();
    const { persistent, reason } = await describePersistence();
    res.json({
      status: 'ok',
      message: 'Internship Portal backend is running.',
      storage: store.backend,
      persistent,
      // Says WHY, so a wrong answer is debuggable instead of silently trusted.
      persistenceReason: reason,
      dataDir: DATA_DIR,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Internship Portal storage did not initialize.',
      error: error.message,
    });
  }
});

// ── GET/POST /api/tracker?profile=id ─────────────────────────────
app.get('/api/tracker', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const tracker = await store.getJson(trackerKey(profile), {});
    res.json(validateTracker(tracker && typeof tracker === 'object' && !Array.isArray(tracker) ? tracker : {}));
  } catch (error) {
    sendRequestError(res, error);
  }
});

app.post('/api/tracker', async (req, res) => {
  try {
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const tracker = validateTracker(req.body);
    await store.setJson(trackerKey(profile), tracker);
    res.json({ saved: true, profile, count: Object.keys(tracker).length });
  } catch (error) {
    sendRequestError(res, error);
  }
});

// ── Gmail integration: read-only OAuth connect flow ──────────────
// Where to send the browser back to after the OAuth round-trip (the SPA). In
// prod the SPA and API share an origin, so derive it from the request and the
// integration works on any deployed domain with no extra config. In dev the API
// is :5005 but the SPA is :5173, so fall back to the explicit origin.
const gmailAppRedirect = (req) => {
  if (process.env.RESUME_STUDIO_APP_ORIGIN) return process.env.RESUME_STUDIO_APP_ORIGIN;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  if (host && !/^(localhost|127\.0\.0\.1)/.test(host)) return `${proto}://${host}`;
  return 'http://localhost:5173';
};

// Config/connection status — safe to call anytime; never returns token material.
app.get('/api/integrations/gmail/status', async (req, res) => {
  try {
    setNoStore(res);
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const configured = gmailOAuth.oauthConfigured() && encAvailable();
    const conn = await gmailStore.getConnection(store, profile);
    res.json({ configured, ...gmailStore.publicStatus(conn) });
  } catch (error) {
    sendRequestError(res, error);
  }
});

// Begin OAuth: returns the Google consent URL (CSRF state stored server-side).
app.get('/api/integrations/gmail/auth-url', async (req, res) => {
  try {
    setNoStore(res);
    if (!gmailOAuth.oauthConfigured() || !encAvailable()) {
      return res.status(503).json({ error: 'Gmail integration is not configured on the server.' });
    }
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const nonce = randomUUID();
    await gmailStore.saveOAuthState(store, nonce, { profile });
    res.json({ url: gmailOAuth.buildAuthUrl(nonce) });
  } catch (error) {
    sendRequestError(res, error);
  }
});

// OAuth redirect target (registered on the Google OAuth client). Exchanges the
// code, stores the encrypted refresh token + a sync baseline, then bounces the
// browser back to the app.
app.get('/api/integrations/gmail/callback', async (req, res) => {
  const backTo = gmailAppRedirect(req);
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.redirect(`${backTo}/?gmail=denied`);
    const stateData = state ? await gmailStore.takeOAuthState(store, String(state)) : null;
    if (!code || !stateData) return res.redirect(`${backTo}/?gmail=error`);
    const profile = validateProfileId(stateData.profile);

    const tokens = await gmailOAuth.exchangeCode(String(code));
    if (!tokens.refresh_token) {
      // No refresh token means we can't sync in the background — usually a re-consent
      // without prompt=consent. Our auth URL forces consent, so this is rare.
      return res.redirect(`${backTo}/?gmail=norefresh`);
    }
    const email = await gmailOAuth.fetchEmail(tokens.access_token);
    // Sync baseline: only mail that arrives AFTER connect is ingested.
    let historyId = null;
    try {
      const pr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const pj = await pr.json().catch(() => ({}));
      historyId = pj.historyId || null;
    } catch { /* first sync will establish the baseline instead */ }

    await gmailStore.setRefreshToken(store, profile, {
      email,
      historyId,
      connectedAt: new Date().toISOString(),
      lastSyncAt: null,
      lastError: null,
      settings: { autoApply: true },
    }, tokens.refresh_token);

    res.redirect(`${backTo}/?gmail=connected`);
  } catch (error) {
    console.error('Gmail callback failed:', error.message);
    res.redirect(`${backTo}/?gmail=error`);
  }
});

// Disconnect: revoke at Google (best-effort) and delete all local state.
app.post('/api/integrations/gmail/disconnect', async (req, res) => {
  try {
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const conn = await gmailStore.getConnection(store, profile);
    const refreshToken = gmailStore.readRefreshToken(conn);
    if (refreshToken) await gmailOAuth.revokeToken(refreshToken);
    await gmailStore.deleteConnection(store, profile);
    res.json({ disconnected: true });
  } catch (error) {
    sendRequestError(res, error);
  }
});

// Run a sync on demand (also called by the client on load) and return a summary.
app.post('/api/integrations/gmail/sync-now', async (req, res) => {
  try {
    setNoStore(res);
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    // Up to two years: the client's period picker goes to "2 years". The scan
    // still stops at 80 messages, so a wider window costs no more model calls.
    const backfill = Math.min(Number(req.query.backfill) || 0, 730);
    const manual = req.query.manual === '1';
    const result = await syncProfile(store, profile, { ...(backfill > 0 ? { backfillDays: backfill } : {}), manual });
    res.json({ ok: true, ...result });
  } catch (error) {
    sendRequestError(res, error);
  }
});

// Pause or resume automatic scans for a profile. Body: { aiPaused: boolean }.
app.post('/api/integrations/gmail/automation', async (req, res) => {
  try {
    setNoStore(res);
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    if (typeof req.body?.aiPaused !== 'boolean') return res.status(400).json({ error: 'aiPaused must be a boolean.' });
    const conn = await gmailStore.setAiPaused(store, profile, req.body.aiPaused);
    if (!conn) return res.status(404).json({ error: 'Gmail is not connected for this profile.' });
    res.json(gmailStore.publicStatus(conn));
  } catch (error) {
    sendRequestError(res, error);
  }
});

// Pending Gmail-derived actions for the client to apply to its Firestore tracker.
app.get('/api/integrations/gmail/pending', async (req, res) => {
  try {
    setNoStore(res);
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    res.json({ actions: await gmailStore.getQueue(store, profile) });
  } catch (error) {
    sendRequestError(res, error);
  }
});

// Client acks actions it has applied; they are removed from the queue.
app.post('/api/integrations/gmail/ack', async (req, res) => {
  try {
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const remaining = await gmailStore.ackQueue(store, profile, ids);
    res.json({ ok: true, remaining });
  } catch (error) {
    sendRequestError(res, error);
  }
});

// ── Live internship catalog and company research ────────────────
app.get('/api/internships', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    const items = await readInternshipCatalog();
    res.json({ items, meta: internshipCatalogMeta(items) });
  } catch (error) {
    sendRequestError(res, error);
  }
});

app.post('/api/internships', async (req, res) => {
  try {
    const item = validateInternship(req.body);
    if (!String(item.id).startsWith('live-') || item.prestigeTier !== 'Live company research' || !item.verifiedDate) {
      return res.status(400).json({ error: 'Only live-researched internship results can be added.' });
    }
    const catalog = await readInternshipCatalog();
    const existing = catalog.find(candidate => candidate.id === item.id || candidate.url === item.url);
    if (existing) return res.json({ added: false, internship: existing });
    await writeInternshipCatalog([item, ...catalog]);
    res.status(201).json({ added: true, internship: item });
  } catch (error) {
    sendRequestError(res, error);
  }
});

app.get('/api/internships/custom', async (req, res) => {
  try {
    res.json(await readCustomInternships());
  } catch (error) {
    sendRequestError(res, error);
  }
});

app.post('/api/internships/custom', async (req, res) => {
  try {
    const item = validateInternship(req.body);
    if (!String(item.id).startsWith('live-') || item.prestigeTier !== 'Live company research' || !item.verifiedDate) {
      return res.status(400).json({ error: 'Only live-researched internship results can be added to the dashboard.' });
    }
    const items = await readCustomInternships();
    const existing = items.find(entry => entry.id === item.id || entry.url === item.url);
    if (existing) return res.json({ added: false, internship: existing });
    const normalized = {
      ...item,
      verifiedDate: item.verifiedDate || new Date().toISOString().slice(0, 10),
      addedAt: new Date().toISOString(),
    };
    items.unshift(normalized);
    await writeCustomInternships(items);
    res.status(201).json({ added: true, internship: normalized });
  } catch (error) {
    sendRequestError(res, error);
  }
});

// Remove a live-researched result. Without this the catalog was add-only: a wrong
// or stale search result could never be taken back out, since these entries are
// user-generated and therefore absent from server/seeds.
app.delete('/api/internships/custom/:id', async (req, res) => {
  try {
    const id = validateInternshipId(req.params.id);
    const items = await readCustomInternships();
    const next = items.filter(entry => entry.id !== id);
    if (next.length === items.length) {
      return res.status(404).json({ error: 'No live-researched internship with that id.' });
    }
    await writeCustomInternships(next);
    // The id is also dropped from the shared catalog, so it cannot reappear via
    // the live-research merge in readInternshipCatalog().
    const catalog = await readInternshipCatalog();
    await writeInternshipCatalog(catalog.filter(entry => entry.id !== id));
    res.json({ removed: true, id });
  } catch (error) {
    sendRequestError(res, error);
  }
});

app.post('/api/internships/research-company', async (req, res) => {
  const company = String(req.body?.company || '').trim();
  let profileId;
  try {
    profileId = validateProfileId(req.body?.profile || 'mohamed_fuad');
  } catch (error) {
    return sendRequestError(res, error);
  }
  if (!/^[\p{L}\p{N}&.' -]{2,80}$/u.test(company)) {
    return res.status(400).json({ error: 'Enter a company name between 2 and 80 characters.' });
  }
  const companyKey = company.toLocaleLowerCase('en').replace(/\s+/g, ' ');
  const cachedId = internshipResearchByCompany.get(companyKey);
  const cachedJob = cachedId ? internshipResearchJobs.get(cachedId) : null;
  const cachedAt = cachedJob?.completedAt || cachedJob?.searchedAt || cachedJob?.startedAt;
  if (cachedJob && (cachedJob.status === 'researching' || (cachedJob.status === 'complete' && cachedAt && Date.now() - new Date(cachedAt).getTime() < RESEARCH_CACHE_MS))) {
    return res.status(cachedJob.status === 'researching' ? 202 : 200).json(cachedJob);
  }
  const jobId = randomUUID();
  internshipResearchJobs.set(jobId, { jobId, company, status: 'researching', startedAt: new Date().toISOString() });
  internshipResearchByCompany.set(companyKey, jobId);
  res.status(202).json({ jobId, company, status: 'researching' });

  // Client-direct users own their résumé + OpenRouter key in Firestore, so both may
  // arrive in the request body; fall back to server KV / env otherwise. Phase 3.
  const bodyResume = req.body?.resume && typeof req.body.resume === 'object' ? req.body.resume : null;
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  const searchModel = typeof req.body?.searchModel === 'string' ? req.body.searchModel.trim() : '';

  Promise.resolve().then(async () => {
    try {
      const resume = bodyResume || await readProfile(profileId);
      const research = await researchCompanyInternships({ company, resume, rootDir: RESUME_ROOT, apiKey, searchModel });
      internshipResearchJobs.set(jobId, { jobId, status: 'complete', completedAt: new Date().toISOString(), ...research });
    } catch (error) {
      internshipResearchJobs.set(jobId, {
        jobId,
        company,
        status: 'error',
        error: error.message || 'Company research failed',
        errorCode: error.code || null,
        completedAt: new Date().toISOString(),
      });
    }
  });
});

app.get('/api/internships/research-company/:jobId', (req, res) => {
  const job = internshipResearchJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Research job not found or server restarted.' });
  res.json(job);
});

// ── GET /api/profiles ─────────────────────────────────────────────
app.get('/api/profiles', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.json(await listProfiles());
  } catch (e) {
    sendRequestError(res, e);
  }
});

// ── DELETE /api/profiles/:id ──────────────────────────────────────
app.delete('/api/profiles/:id', async (req, res) => {
  try {
    const id = validateProfileId(req.params.id);
    if (PROTECTED_PROFILE_IDS.has(id)) {
      return res.status(400).json({ error: 'Cannot delete the default profile.' });
    }
    await deleteProfile(id);
    res.json({ ok: true, success: true });
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'Profile not found.' });
    sendRequestError(res, e);
  }
});

// ── GET /api/resume ──────────────────────────────────────────────
app.get('/api/resume', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.json(await readProfile(validateProfileId(req.query.profile || 'mohamed_fuad')));
  } catch (e) {
    sendRequestError(res, e);
  }
});

// ── POST /api/resume ─────────────────────────────────────────────
app.post('/api/resume', async (req, res) => {
  try {
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    await writeProfile(profile, validateResume(req.body));
    res.json({ ok: true });
  } catch (e) {
    sendRequestError(res, e);
  }
});

// ── POST /api/save?profile=id ─────────────────────────────────────
// Backward-compatible save route used by the frontend autosave flow.
app.post('/api/save', async (req, res) => {
  try {
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    await writeProfile(profile, validateResume(req.body));
    res.json({ ok: true });
  } catch (e) {
    sendRequestError(res, e);
  }
});

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`✅ Internship Portal backend on http://localhost:${PORT}`);
  });
  startGmailSyncLoop();
}

// 24/7 Gmail poll — only on a long-lived process (the single-replica Azure
// container), never in Vercel serverless (module import ≠ direct run). Syncs
// every connected profile so new mail is ingested even while no browser is open;
// the client drains the resulting queue into Firestore when it next loads.
function startGmailSyncLoop() {
  if (String(process.env.GMAIL_SYNC_DISABLED || '') === '1') return;
  const intervalMs = Number(process.env.GMAIL_SYNC_INTERVAL_MS || 300000); // 5 min
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const profiles = await gmailStore.listConnectedProfiles(store);
      for (const profile of profiles) {
        try {
          const r = await syncProfile(store, profile);
          if (r.actions) console.log(`[gmail-sync] ${profile}: ${r.actions} new action(s)`);
        } catch (error) {
          console.warn(`[gmail-sync] ${profile} failed: ${error.message}`);
        }
      }
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 15000); // first run shortly after boot
  setInterval(tick, intervalMs);
  console.log(`✅ Gmail sync loop every ${Math.round(intervalMs / 1000)}s`);
}

export default app;

// ── Default resume data ──────────────────────────────────────────
function createEmptyResume() {
  return {
    personal: { nameEn: '', nameJa: '', furigana: '', dob: '', address: '', phone: '', email: '', linkedin: '', github: '', photoDataUrl: '' },
    education: [],
    experience: [],
    projects: [],
    skills: { languages: '', frameworks: '', tools: '', concepts: '', spoken: '' },
    activities: [],
    summary: '',
  };
}
