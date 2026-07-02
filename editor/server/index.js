import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { generateLatex } from './templates.js';
import { runResumeChat } from './resume-chat.js';
import { researchCompanyInternships } from './internship-research.js';
import { createStore } from './storage.js';
import {
  INTERNSHIP_RESEARCH_DATE,
  INTERNSHIP_RESEARCH_NOTE,
  internshipStats as seedInternshipStats,
} from './seeds/internships.js';
import { buildSeedCatalog } from './seeds/catalog.js';
import { isRetiredInternshipId } from './seeds/catalog-audit-2026-07-02.js';
import {
  sendRequestError,
  validateApplication,
  validateInternship,
  validateProfileId,
  validateResume,
  validateTracker,
} from './validation.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESUME_ROOT = path.resolve(__dirname, '../../');
const DATA_FILE = path.join(RESUME_ROOT, 'editor', 'resume.json');
const PROFILES_DIR = path.join(__dirname, 'profiles');
const CUSTOM_INTERNSHIPS_FILE = path.join(__dirname, 'custom-internships.json');
const APPLICATIONS_DIR = path.join(__dirname, 'applications');
const DATA_DIR = process.env.RESUME_STUDIO_DATA_DIR || path.join(__dirname, '.data');
const TECTONIC = process.env.TECTONIC_PATH || '/opt/homebrew/bin/tectonic';
const store = createStore({ localDbPath: path.join(DATA_DIR, 'resume-studio.sqlite') });
const internshipResearchJobs = new Map();
const internshipResearchByCompany = new Map();
const RESEARCH_CACHE_MS = 15 * 60 * 1000;
const VALID_TEMPLATES = new Set(['en_01', 'en_02', 'en_03', 'en_04', 'ja_01', 'ja_02', 'ja_03']);

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

async function readInternshipCatalog() {
  const stored = await store.getJson(INTERNSHIP_CATALOG_KEY, null);
  const seedCatalog = buildSeedCatalog().map(validateInternship);
  if (Array.isArray(stored) && stored.length) {
    const seedIds = new Set(seedCatalog.map(item => item.id));
    const liveResearch = stored
      .filter(item => item?.prestigeTier === 'Live company research' && !isRetiredInternshipId(item?.id))
      .map(validateInternship);
    const nonSeedStored = stored
      .filter(item => item?.prestigeTier !== 'Live company research' && !seedIds.has(item?.id) && !isRetiredInternshipId(item?.id))
      .map(validateInternship);
    const catalog = mergeInternships(liveResearch, seedCatalog, nonSeedStored);
    if (catalog.length !== stored.length || JSON.stringify(catalog) !== JSON.stringify(stored)) {
      await store.setJson(INTERNSHIP_CATALOG_KEY, catalog);
    }
    return catalog;
  }
  const legacyCustom = await store.getJson('customInternships', []);
  const catalog = mergeInternships(
    Array.isArray(legacyCustom)
      ? legacyCustom.filter(item => !isRetiredInternshipId(item?.id)).map(validateInternship)
      : [],
    seedCatalog,
  );
  await store.setJson(INTERNSHIP_CATALOG_KEY, catalog);
  return catalog;
}

async function writeInternshipCatalog(items) {
  const catalog = mergeInternships(
    items.filter(item => !isRetiredInternshipId(item?.id)).map(validateInternship),
  );
  await store.setJson(INTERNSHIP_CATALOG_KEY, catalog);
  return catalog;
}

function internshipCatalogMeta(items) {
  const verifiedDates = items.map(item => item.verifiedDate).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date || '')).sort();
  return {
    target: Math.max(seedInternshipStats.target || 200, items.length),
    researchDate: verifiedDates.at(-1) || INTERNSHIP_RESEARCH_DATE,
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
    return stored
      .map(({ key, value }) => ({ id: key.replace(/^profile:/, ''), value }))
      .filter(({ id }) => !RETIRED_PROFILE_IDS.includes(id))
      .map(({ id, value }) => ({ id, name: value.personal?.nameEn || value.personalInfo?.fullName || id, fileName: `${id}.json` }));
  }
  await ensureSampleProfiles();
  return listProfiles();
}

// Force-seed each shipped sample profile whose KV key is missing but whose
// <id>.json file exists. Idempotent: readProfile returns stored data untouched
// when present and only writes to the store when seeding from disk.
async function ensureSampleProfiles() {
  for (const sampleId of SAMPLE_PROFILE_IDS) {
    await readProfile(sampleId);
  }
}

// Delete the KV rows for any retired profile ids (profile:/tracker:/applications:).
// Idempotent — safe to run on every boot; rewrites the Blob snapshot so prod is cleaned
// on the next deploy. See BUG-008.
async function purgeRetiredProfiles() {
  for (const id of RETIRED_PROFILE_IDS) {
    await store.deleteKey(profileKey(id)).catch(() => {});
    await store.deleteKey(trackerKey(id)).catch(() => {});
    await store.deleteKey(applicationsKey(id)).catch(() => {});
  }
}

async function deleteProfile(profileId) {
  const id = validateProfileId(profileId);
  await store.deleteKey(profileKey(id));
  await store.deleteKey(trackerKey(id));
  await store.deleteKey(applicationsKey(id));
  if (!process.env.VERCEL) {
    await fs.unlink(path.join(PROFILES_DIR, `${id}.json`)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

async function materializeResumePhoto(resume, tmpDir) {
  const dataUrl = resume?.personal?.photoDataUrl || resume?.personalInfo?.photoDataUrl || '';
  const match = String(dataUrl).match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length || bytes.length > 6 * 1024 * 1024) return null;
  const sourceExt = mime === 'jpeg' ? 'jpg' : mime;
  const sourcePath = path.join(tmpDir, `resume-photo.${sourceExt}`);
  await fs.writeFile(sourcePath, bytes);
  if (sourceExt !== 'webp') return sourcePath;
  const pngPath = path.join(tmpDir, 'resume-photo.png');
  try {
    await execFileAsync('/usr/bin/sips', ['-s', 'format', 'png', sourcePath, '--out', pngPath]);
    return pngPath;
  } catch {
    return null;
  }
}

async function persistCompiledPdf(template, pdfData, { mirrorLocal = !process.env.VERCEL } = {}) {
  await store.setJson(`compiled:${template}`, {
    contentType: 'application/pdf',
    base64: pdfData.toString('base64'),
    updatedAt: new Date().toISOString(),
  });

  if (mirrorLocal) {
    const publicPdfPath = path.join(PUBLIC_DIR, `resume_${template}.pdf`);
    await fs.writeFile(publicPdfPath, pdfData);
  }
}

async function readCompiledPdf(template) {
  const stored = await store.getJson(`compiled:${template}`, null);
  if (stored?.base64) {
    return {
      contentType: stored.contentType || 'application/pdf',
      data: Buffer.from(stored.base64, 'base64'),
      source: 'store',
    };
  }
  const fallbackPaths = [
    path.join(PUBLIC_DIR, `resume_${template}.pdf`),
    path.join(__dirname, 'seed-pdfs', `resume_${template}.pdf`),
  ];
  for (const pdfPath of fallbackPaths) {
    try {
      const data = await fs.readFile(pdfPath);
      await persistCompiledPdf(template, data, { mirrorLocal: false });
      return { contentType: 'application/pdf', data, source: 'seed' };
    } catch {
      // Try the next fallback path.
    }
  }
  return null;
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
        for (const file of files.filter(f => f.endsWith('.json'))) {
          const id = file.replace(/\.json$/, '');
          const raw = await fs.readFile(path.join(PROFILES_DIR, file), 'utf8');
          await store.setJson(profileKey(id), JSON.parse(raw));
        }
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

const PUBLIC_DIR = path.join(__dirname, 'public');
fs.mkdir(PUBLIC_DIR, { recursive: true }).catch(() => {});
app.use('/public', express.static(PUBLIC_DIR));


// ── GET /api/status ──────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  try {
    await store.init();
    res.json({
      status: 'ok',
      message: 'Internship Portal backend is running.',
      storage: store.backend,
      persistent: store.backend === 'vercel-blob-sqlite' || store.backend === 'local-sqlite',
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

  Promise.resolve().then(async () => {
    try {
      const resume = await readProfile(profileId);
      const research = await researchCompanyInternships({ company, resume, rootDir: RESUME_ROOT });
      internshipResearchJobs.set(jobId, { jobId, status: 'complete', completedAt: new Date().toISOString(), ...research });
    } catch (error) {
      internshipResearchJobs.set(jobId, {
        jobId,
        company,
        status: 'error',
        error: error.message || 'Company research failed',
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

// ── POST /api/chat/edit ─────────────────────────────────────────
// Applies validated natural-language changes through Codex, with a
// deterministic local path for simple contact/summary/skill edits.
app.post('/api/chat/edit', async (req, res) => {
  const { resume, instruction, language = 'en' } = req.body || {};
  try {
    const safeResume = validateResume(resume);
    const safeInstruction = String(instruction || '').trim();
    if (!safeInstruction || safeInstruction.length > 4000) return res.status(400).json({ error: 'Instruction must be between 1 and 4000 characters.' });
    const result = await runResumeChat({ resume: safeResume, instruction: safeInstruction, language: language === 'ja' ? 'ja' : 'en', rootDir: RESUME_ROOT });
    res.json(result);
  } catch (error) {
    sendRequestError(res, error);
  }
});

// ── POST /api/compile ────────────────────────────────────────────
// Body: { template: 'en_01' | 'en_02' | ..., resume: {...} }
// Returns: JSON with pdfUrl or error
app.post('/api/compile', async (req, res) => {
  const { template } = req.body || {};
  if (!VALID_TEMPLATES.has(template)) return res.status(400).json({ error: 'Invalid resume template.' });
  let resume;
  try {
    resume = validateResume(req.body?.resume);
  } catch (error) {
    return sendRequestError(res, error);
  }
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-'));

  try {
    const photoFile = await materializeResumePhoto(resume, tmpDir);
    const latex = generateLatex(template, resume, { photoFile });
    const texFile = path.join(tmpDir, 'resume.tex');
    await fs.writeFile(texFile, latex, 'utf8');

    await execFileAsync(TECTONIC, [texFile, '-r', '0', '--outdir', tmpDir]);

    const pdfFile = path.join(tmpDir, 'resume.pdf');
    const pdfData = await fs.readFile(pdfFile);
    await persistCompiledPdf(template, pdfData);

    res.json({ success: true, pdfUrl: `/api/compiled/resume_${template}.pdf` });
  } catch (e) {
    console.error('Compile error:', e.message);
    const fallback = await readCompiledPdf(template);
    if (fallback) {
      return res.json({
        success: true,
        pdfUrl: `/api/compiled/resume_${template}.pdf`,
        cached: true,
        warning: `Live PDF compilation is unavailable in this environment; serving the latest saved ${template} PDF.`,
      });
    }
    res.status(500).json({ error: e.message || 'Compilation failed' });
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

app.get('/api/compiled/:file', async (req, res) => {
  const match = String(req.params.file || '').match(/^resume_([a-z]{2}_\d{2})\.pdf$/i);
  if (!match) return res.status(404).json({ error: 'Compiled PDF not found.' });
  const compiled = await readCompiledPdf(match[1]);
  if (!compiled) return res.status(404).json({ error: 'Compile the resume first.' });
  res.setHeader('Content-Type', compiled.contentType || 'application/pdf');
  res.setHeader('Cache-Control', 'no-store');
  res.send(compiled.data);
});

// ── GET /api/export/tex?template=en_01&profile=mohamed_fuad ──────
app.get('/api/export/tex', async (req, res) => {
  try {
    const template = String(req.query.template || '');
    if (!VALID_TEMPLATES.has(template)) return res.status(400).json({ error: 'Invalid resume template.' });
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const resume = await readProfile(profile);
    const latex = generateLatex(template, resume);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="resume_${template}.tex"`);
    res.send(latex);
  } catch (e) {
    sendRequestError(res, e);
  }
});

// ── GET /api/export/json?profile=mohamed_fuad ────────────────────
app.get('/api/export/json', async (req, res) => {
  try {
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const raw = JSON.stringify(await readProfile(profile), null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${profile}.json"`);
    res.send(raw);
  } catch (e) {
    sendRequestError(res, e);
  }
});

// ── GET /api/export/pdf?template=en_01&profile=mohamed_fuad ──────
app.get('/api/export/pdf', async (req, res) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-'));
  try {
    const template = String(req.query.template || '');
    if (!VALID_TEMPLATES.has(template)) return res.status(400).json({ error: 'Invalid resume template.' });
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const resume = await readProfile(profile);
    const latex = generateLatex(template, resume);
    const texFile = path.join(tmpDir, 'resume.tex');
    await fs.writeFile(texFile, latex, 'utf8');
    await execFileAsync(TECTONIC, [texFile, '-r', '0', '--outdir', tmpDir]);
    const pdfData = await fs.readFile(path.join(tmpDir, 'resume.pdf'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume_${template}.pdf"`);
    res.send(pdfData);
  } catch (e) {
    sendRequestError(res, e);
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

// ── GET /api/export/ai?profile=mohamed_fuad ──────────────────────
app.get('/api/export/ai', async (req, res) => {
  try {
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    const r = await readProfile(profile);
    const md = buildAIProfile(r);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${profile}_job_profile.md"`);
    res.send(md);
  } catch (e) {
    sendRequestError(res, e);
  }
});

// ── POST export variants (client-direct Firestore) ───────────────
// These accept the résumé in the request body so the server needs no KV profile
// lookup. The signed-in client owns its résumé in Firestore and posts it here.
app.post('/api/export/tex', async (req, res) => {
  try {
    const template = String(req.body?.template || '');
    if (!VALID_TEMPLATES.has(template)) return res.status(400).json({ error: 'Invalid resume template.' });
    const resume = validateResume(req.body?.resume);
    const latex = generateLatex(template, resume);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="resume_${template}.tex"`);
    res.send(latex);
  } catch (e) {
    sendRequestError(res, e);
  }
});

app.post('/api/export/pdf', async (req, res) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-'));
  try {
    const template = String(req.body?.template || '');
    if (!VALID_TEMPLATES.has(template)) return res.status(400).json({ error: 'Invalid resume template.' });
    const resume = validateResume(req.body?.resume);
    const photoFile = await materializeResumePhoto(resume, tmpDir);
    const latex = generateLatex(template, resume, { photoFile });
    const texFile = path.join(tmpDir, 'resume.tex');
    await fs.writeFile(texFile, latex, 'utf8');
    await execFileAsync(TECTONIC, [texFile, '-r', '0', '--outdir', tmpDir]);
    const pdfData = await fs.readFile(path.join(tmpDir, 'resume.pdf'));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume_${template}.pdf"`);
    res.send(pdfData);
  } catch (e) {
    sendRequestError(res, e);
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

app.post('/api/export/ai', async (req, res) => {
  try {
    const resume = validateResume(req.body?.resume);
    const md = buildAIProfile(resume);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="job_profile.md"');
    res.send(md);
  } catch (e) {
    sendRequestError(res, e);
  }
});

// ── POST /api/cover-letter ───────────────────────────────────────
// Stateless cover-letter builder used by the Firestore application flow: the
// client posts its résumé + job details, gets back the generated letter, and
// stores the application record itself under users/{uid}/applications.
app.post('/api/cover-letter', async (req, res) => {
  try {
    const resume = validateResume(req.body?.resume);
    const { company, jobTitle, jobDescription } = validateApplication(req.body);
    const coverLetter = buildCoverLetter(resume, company, jobTitle, jobDescription);
    const fileName = `${company.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${jobTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_application.md`;
    res.json({ success: true, fileName, coverLetter });
  } catch (e) {
    sendRequestError(res, e);
  }
});

// ── GET /api/applications ────────────────────────────────────────
app.get('/api/applications', async (req, res) => {
  try {
    const profile = validateProfileId(req.query.profile || 'mohamed_fuad');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    const list = await getApplications(profile);
    res.json(list);
  } catch (e) {
    sendRequestError(res, e);
  }
});

// ── POST /api/applications ───────────────────────────────────────
app.post('/api/applications', async (req, res) => {
  try {
    const profile = validateProfileId(req.query.profile || req.body?.profile || 'mohamed_fuad');
    const { company, jobTitle, jobDescription, notes } = validateApplication(req.body);
    const resume = await readProfile(profile);
    const coverLetter = buildCoverLetter(resume, company, jobTitle, jobDescription);

    const filename = `${company.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${jobTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_application.md`;
    const existing = await getApplications(profile);
    const application = {
      fileName: filename,
      company,
      jobTitle,
      dateLogged: new Date().toISOString().slice(0, 10),
      status: 'Applied / Logged via Web UI',
      jobDescription,
      notes,
      coverLetter,
    };
    const nextApplications = [application, ...existing.filter(item => item.fileName !== filename)];
    await writeApplications(profile, nextApplications);


    res.json({
      success: true,
      ...application,
    });
  } catch (e) {
    sendRequestError(res, e);
  }
});

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`✅ Internship Portal backend on http://localhost:${PORT}`);
  });
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

// ── AI Job Profile generator ─────────────────────────────────────
// Produces a structured markdown document designed to be consumed by
// AI job-matching tools (ChatGPT, Claude, Gemini, LinkedIn AI, etc.)
// Fields are clearly labelled so LLMs can extract candidate attributes
// and compare them against job descriptions.
function buildAIProfile(r) {
  const p = r.personal || {};
  const sk = r.skills || {};
  const edu = r.education || [];
  const exp = r.experience || [];
  const proj = r.projects || [];
  const acts = r.activities || [];
  const now = new Date().toISOString().slice(0, 10);

  // Build tag cloud from skills
  const allTechTags = [
    ...(sk.languages || '').split(','),
    ...(sk.frameworks || '').split(','),
    ...(sk.tools || '').split(','),
    ...(sk.concepts || '').split(','),
  ].map(t => t.trim()).filter(Boolean).map(t => `[${t}]`).join(' ');

  const spokenTags = (sk.spoken || '').split(',').map(t => `[${t.trim()}]`).join(' ');

  const expBlock = exp.map(e =>
    `### ${e.role || e.roleJa} — ${e.company || e.companyJa}\n` +
    `- **Period**: ${e.startDate} – ${e.endDate}\n` +
    `- **Location**: ${e.location}\n` +
    (e.bullets?.length ? e.bullets.map(b => `- ${b}`).join('\n') : '')
  ).join('\n\n');

  const eduBlock = edu.map(e =>
    `### ${e.degree} — ${e.institution}\n` +
    `- **Period**: ${e.startDate} – ${e.endDate}\n` +
    `- **Location**: ${e.location}\n` +
    (e.bullets?.length ? e.bullets.map(b => `- ${b}`).join('\n') : '')
  ).join('\n\n');

  const projBlock = proj.map(p =>
    `### ${p.title} (${p.year || 'N/A'})\n` +
    `- **Stack**: ${p.tech}\n` +
    (p.bullets?.length ? p.bullets.map(b => `- ${b}`).join('\n') : '')
  ).join('\n\n');

  const actsBlock = acts.map(a =>
    `### ${a.title}${a.org ? ` — ${a.org}` : ''}\n` +
    `- **Period**: ${a.startDate} – ${a.endDate}\n` +
    (a.bullets?.length ? a.bullets.map(b => `- ${b}`).join('\n') : '')
  ).join('\n\n');

  return `---
# AI JOB MATCHING PROFILE
<!-- Generated: ${now} | Format: Structured Markdown for AI parsing -->
<!-- Intended consumers: ChatGPT, Claude, Gemini, LinkedIn AI, ATS systems -->
---

## CANDIDATE OVERVIEW

| Field             | Value |
|-------------------|-------|
| **Full Name**     | ${p.nameEn || ''} (${p.nameJa || ''}) |
| **Location**      | ${p.address || 'Tokyo, Japan'} |
| **Email**         | ${p.email || ''} |
| **Phone**         | ${p.phone || ''} |
| **LinkedIn**      | ${p.linkedin || ''} |
| **GitHub**        | ${p.github || ''} |
| **Date of Birth** | ${p.dob || ''} |
| **Languages**     | ${sk.spoken || ''} |

---

## PROFESSIONAL SUMMARY

${r.summary || ''}

---

## TECHNICAL SKILLS

### Programming Languages
${sk.languages || ''}

### Frameworks & Libraries
${sk.frameworks || ''}

### Tools & Infrastructure
${sk.tools || ''}

### Concepts & Methodologies
${sk.concepts || ''}

### Spoken Languages
${sk.spoken || ''}

---

## WORK EXPERIENCE

${expBlock || '_No experience listed._'}

---

## EDUCATION

${eduBlock || '_No education listed._'}

---

## PROJECTS

${projBlock || '_No projects listed._'}

---

## ACTIVITIES & CERTIFICATIONS

${actsBlock || '_No activities listed._'}

---

## JOB MATCHING TAGS
<!-- AI: Use these tags to match against job requirements -->

### Technical Tags
${allTechTags}

### Language Tags
${spokenTags}

### Profile Tags
[Tokyo] [Japan-Based] [Bilingual-EN-JA] [JLPT-N2] [Student-Developer]
[Full-Stack] [Web-Development] [Mobile-First] [REST-API] [Open-Source]

---
<!-- END OF AI JOB PROFILE -->
`;
}

// ── Helper to parse and list applications ────────────────────────
async function getApplications(profileId = 'mohamed_fuad') {
  const profile = validateProfileId(profileId);
  const stored = await store.getJson(applicationsKey(profile), null);
  if (Array.isArray(stored)) return stored;
  if (profile === 'mohamed_fuad') {
    const legacy = await store.getJson('applications', null);
    if (Array.isArray(legacy)) {
      await store.setJson(applicationsKey(profile), legacy);
      return legacy;
    }
  }
  if (profile !== 'mohamed_fuad') {
    await store.setJson(applicationsKey(profile), []);
    return [];
  }
  const dir = APPLICATIONS_DIR;
  try {
    await fs.mkdir(dir, { recursive: true });
    const files = await fs.readdir(dir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    const list = [];

    for (const f of mdFiles) {
      const fullPath = path.join(dir, f);
      const content = await fs.readFile(fullPath, 'utf8');

      // Parsing using regex
      const titleMatch = content.match(/# Application Dossier:\s*(.*?)\s+at\s+(.*)/);
      const jobTitle = titleMatch ? titleMatch[1].trim() : 'Unknown Role';
      const company = titleMatch ? titleMatch[2].trim() : 'Unknown Company';

      const dateMatch = content.match(/-\s+\*\*Date Logged\*\*:\s*([0-9-]{10})/);
      const dateLogged = dateMatch ? dateMatch[1].trim() : '';

      const statusMatch = content.match(/-\s+\*\*Status\*\*:\s*(.*)/);
      const status = statusMatch ? statusMatch[1].trim() : 'Applied';

      let jobDescription = '';
      const descIndex = content.indexOf('## Job Description / Requirements');
      if (descIndex !== -1) {
        const subContent = content.substring(descIndex + '## Job Description / Requirements'.length);
        const nextHeading = subContent.indexOf('##');
        if (nextHeading !== -1) {
          jobDescription = subContent.substring(0, nextHeading).trim();
        } else {
          jobDescription = subContent.trim();
        }
      }

      let notes = '';
      const notesIndex = content.indexOf('## Notes');
      if (notesIndex !== -1) {
        const subContent = content.substring(notesIndex + '## Notes'.length);
        const nextHeading = subContent.indexOf('##');
        if (nextHeading !== -1) {
          notes = subContent.substring(0, nextHeading).trim();
        } else {
          notes = subContent.trim();
        }
      }

      let coverLetter = '';
      const clIndex = content.indexOf('## Auto-Generated Cover Letter');
      if (clIndex !== -1) {
        const subContent = content.substring(clIndex + '## Auto-Generated Cover Letter'.length);
        const textBlockMatch = subContent.match(/```text\s*([\s\S]*?)```/);
        if (textBlockMatch) {
          coverLetter = textBlockMatch[1].trim();
        }
      }

      list.push({
        fileName: f,
        company,
        jobTitle,
        dateLogged,
        status,
        jobDescription,
        notes,
        coverLetter
      });
    }

    list.sort((a, b) => b.dateLogged.localeCompare(a.dateLogged));
    await store.setJson(applicationsKey(profile), list);
    return list;
  } catch (e) {
    console.error('Error reading applications:', e);
    return [];
  }
}

async function writeApplications(profileId, list) {
  const profile = validateProfileId(profileId);
  await store.setJson(applicationsKey(profile), list);
  if (process.env.VERCEL) return;
  if (profile !== 'mohamed_fuad') return;
  await fs.mkdir(APPLICATIONS_DIR, { recursive: true });
  for (const item of list) {
    if (!item.fileName) continue;
    const dossierContent = `# Application Dossier: ${item.jobTitle} at ${item.company}
- **Date Logged**: ${item.dateLogged}
- **Status**: ${item.status}

## Job Description / Requirements
${item.jobDescription || ''}

${item.notes ? `## Notes\n${item.notes}\n` : ''}
## Auto-Generated Cover Letter
\`\`\`text
${item.coverLetter || ''}
\`\`\`
`;
    await fs.writeFile(path.join(APPLICATIONS_DIR, item.fileName), dossierContent, 'utf8');
  }
}

// ── Cover Letter Generator ──────────────────────────────────────────
function buildCoverLetter(r, company, jobTitle, jobDescription) {
  const p = r.personal || {};
  const education = r.education?.[0] || {};
  const exp = r.experience?.[0] || {};
  const projectNames = (r.projects || []).slice(0, 3).map(project => project.title || project.name).filter(Boolean);
  const skills = [r.skills?.languages, r.skills?.frameworks, r.skills?.tools].filter(Boolean).join(', ');
  const identity = [education.degree, education.institution || education.school].filter(Boolean).join(' student at ');
  const experience = [exp.role, exp.company].filter(Boolean).join(' at ');
  const evidence = [
    skills ? `My technical background includes ${skills}.` : '',
    projectNames.length ? `Projects such as ${projectNames.join(', ')} demonstrate my ability to ship working software.` : '',
    experience ? `My experience as ${experience} strengthened my professional communication and execution.` : '',
  ].filter(Boolean).join(' ');
  const requirementContext = String(jobDescription || '').trim().slice(0, 600);
  return `Dear Hiring Team at ${company},

I am writing to express my interest in the ${jobTitle} position at ${company}.${identity ? ` As a ${identity},` : ''} I would welcome the opportunity to contribute to your team.

${evidence || r.summary || 'My resume includes the experience and projects most relevant to this application.'}
${requirementContext ? `I am particularly interested in the responsibilities described for this role and would be glad to discuss how my background maps to them.` : ''}

Thank you for your time and consideration. I would welcome the opportunity to discuss how my technical skills and background align with the needs of ${company}.

Sincerely,
${p.nameEn || p.nameJa || ''}
${[p.email, p.phone].filter(Boolean).join(' | ')}
`;
}
