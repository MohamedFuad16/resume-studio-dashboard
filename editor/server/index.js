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

const sanitizeProfileId = value => String(value || 'mohamed_fuad').replace(/[^a-zA-Z0-9_-]/g, '') || 'mohamed_fuad';
const profileKey = id => `profile:${sanitizeProfileId(id)}`;
const trackerKey = id => `tracker:${sanitizeProfileId(id)}`;

async function readCustomInternships() {
  const stored = await store.getJson('customInternships', null);
  if (Array.isArray(stored)) return stored;
  try {
    const parsed = JSON.parse(await fs.readFile(CUSTOM_INTERNSHIPS_FILE, 'utf8'));
    if (Array.isArray(parsed)) {
      await store.setJson('customInternships', parsed);
      return parsed;
    }
    return [];
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not read custom internships:', error.message);
    return [];
  }
}

async function writeCustomInternships(items) {
  await store.setJson('customInternships', items);
  if (!process.env.VERCEL) {
    await fs.writeFile(CUSTOM_INTERNSHIPS_FILE, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  }
}

async function readProfile(profileId = 'mohamed_fuad') {
  const id = sanitizeProfileId(profileId);
  const stored = await store.getJson(profileKey(id), null);
  if (stored) return stored;
  const file = path.join(PROFILES_DIR, `${id}.json`);
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    await store.setJson(profileKey(id), parsed);
    return parsed;
  } catch {
    if (id === 'mohamed_fuad') {
      let defaultData;
      try {
        defaultData = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
      } catch {
        defaultData = getDefaultResume();
      }
      await store.setJson(profileKey(id), defaultData);
      return defaultData;
    }
    return getDefaultResume();
  }
}

async function writeProfile(profileId, data) {
  const id = sanitizeProfileId(profileId);
  await store.setJson(profileKey(id), data);
  if (!process.env.VERCEL) {
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    await fs.writeFile(path.join(PROFILES_DIR, `${id}.json`), JSON.stringify(data, null, 2), 'utf8');
  }
}

async function listProfiles() {
  const stored = await store.listJson('profile:');
  if (stored.length) {
    return stored.map(({ key, value }) => {
      const id = key.replace(/^profile:/, '');
      return { id, name: value.personal?.nameEn || value.personalInfo?.fullName || id, fileName: `${id}.json` };
    });
  }
  await readProfile('mohamed_fuad');
  return listProfiles();
}

async function deleteProfile(profileId) {
  const id = sanitizeProfileId(profileId);
  await store.deleteKey(profileKey(id));
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
    await readProfile('mohamed_fuad');
    await readCustomInternships();
    console.log(`✅ Resume Studio store ready (${store.backend})`);
  } catch (e) {
    console.error('Error initializing persistence:', e);
  }
}
initPersistentStore();


const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json({ limit: '12mb' }));

const PUBLIC_DIR = path.join(__dirname, 'public');
fs.mkdir(PUBLIC_DIR, { recursive: true }).catch(() => {});
app.use('/public', express.static(PUBLIC_DIR));


// ── GET /api/status ──────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  try {
    await store.init();
    res.json({
      status: 'ok',
      message: 'Resume Editor backend is running.',
      storage: store.backend,
      persistent: store.backend === 'vercel-blob-sqlite' || store.backend === 'local-sqlite',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Resume Studio storage did not initialize.',
      error: error.message,
    });
  }
});

// ── GET/POST /api/tracker?profile=id ─────────────────────────────
app.get('/api/tracker', async (req, res) => {
  try {
    const profile = sanitizeProfileId(req.query.profile || 'mohamed_fuad');
    const tracker = await store.getJson(trackerKey(profile), {});
    res.json(tracker && typeof tracker === 'object' && !Array.isArray(tracker) ? tracker : {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tracker', async (req, res) => {
  try {
    const profile = sanitizeProfileId(req.query.profile || 'mohamed_fuad');
    const tracker = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    await store.setJson(trackerKey(profile), tracker);
    res.json({ saved: true, profile, count: Object.keys(tracker).length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Live internship catalog and company research ────────────────
app.get('/api/internships/custom', async (req, res) => {
  res.json(await readCustomInternships());
});

app.post('/api/internships/custom', async (req, res) => {
  const item = req.body;
  if (!item || !item.id || !item.company || !item.role || !/^https:\/\//.test(item.url || '') || !/^https:\/\//.test(item.sourceUrl || '')) {
    return res.status(400).json({ error: 'A verified internship id, company, role, apply URL, and source URL are required.' });
  }
  if (!String(item.id).startsWith('live-') || item.prestigeTier !== 'Live company research' || !item.verifiedDate) {
    return res.status(400).json({ error: 'Only live-researched internship results can be added to the dashboard.' });
  }
  try {
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/internships/research-company', async (req, res) => {
  const company = String(req.body?.company || '').trim();
  const profileId = String(req.body?.profile || 'mohamed_fuad').replace(/[^a-zA-Z0-9_-]/g, '');
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
    res.json(await listProfiles());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/profiles/:id ──────────────────────────────────────
app.delete('/api/profiles/:id', async (req, res) => {
  const id = sanitizeProfileId(req.params.id);
  if (id === 'mohamed_fuad') {
    return res.status(400).json({ error: 'Cannot delete the default profile.' });
  }
  try {
    await deleteProfile(id);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'Profile not found.' });
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/resume ──────────────────────────────────────────────
app.get('/api/resume', async (req, res) => {
  try {
    res.json(await readProfile(req.query.profile || 'mohamed_fuad'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/resume ─────────────────────────────────────────────
app.post('/api/resume', async (req, res) => {
  try {
    await writeProfile(req.query.profile || 'mohamed_fuad', req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/save?profile=id ─────────────────────────────────────
// Backward-compatible save route used by the frontend autosave flow.
app.post('/api/save', async (req, res) => {
  try {
    await writeProfile(req.query.profile || 'mohamed_fuad', req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/chat/edit ─────────────────────────────────────────
// Applies validated natural-language changes through Codex, with a
// deterministic local path for simple contact/summary/skill edits.
app.post('/api/chat/edit', async (req, res) => {
  const { resume, instruction, language = 'en' } = req.body || {};
  try {
    const result = await runResumeChat({ resume, instruction, language, rootDir: RESUME_ROOT });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Resume edit failed' });
  }
});

// ── POST /api/compile ────────────────────────────────────────────
// Body: { template: 'en_01' | 'en_02' | ..., resume: {...} }
// Returns: JSON with pdfUrl or error
app.post('/api/compile', async (req, res) => {
  const { template, resume } = req.body;
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
  const { template, profile = 'mohamed_fuad' } = req.query;
  try {
    const resume = await readProfile(profile);
    const latex = generateLatex(template, resume);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="resume_${template}.tex"`);
    res.send(latex);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/export/json?profile=mohamed_fuad ────────────────────
app.get('/api/export/json', async (req, res) => {
  const { profile = 'mohamed_fuad' } = req.query;
  try {
    const raw = JSON.stringify(await readProfile(profile), null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${profile}.json"`);
    res.send(raw);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/export/pdf?template=en_01&profile=mohamed_fuad ──────
app.get('/api/export/pdf', async (req, res) => {
  const { template, profile = 'mohamed_fuad' } = req.query;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resume-'));
  try {
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
    res.status(500).json({ error: e.message });
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

// ── GET /api/export/ai?profile=mohamed_fuad ──────────────────────
app.get('/api/export/ai', async (req, res) => {
  const { profile = 'mohamed_fuad' } = req.query;
  try {
    const r = await readProfile(profile);
    const md = buildAIProfile(r);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${profile}_job_profile.md"`);
    res.send(md);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/applications ────────────────────────────────────────
app.get('/api/applications', async (req, res) => {
  try {
    const list = await getApplications();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/applications ───────────────────────────────────────
app.post('/api/applications', async (req, res) => {
  const { company, jobTitle, jobDescription, notes = '', profile = 'mohamed_fuad' } = req.body;
  if (!company || !jobTitle || !jobDescription) {
    return res.status(400).json({ error: 'Missing required fields: company, jobTitle, jobDescription' });
  }

  try {
    const resume = await readProfile(profile);
    const coverLetter = buildCoverLetter(resume, company, jobTitle, jobDescription);

    const filename = `${company.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${jobTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_application.md`;
    const existing = await getApplications();
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
    await writeApplications(nextApplications);


    res.json({
      success: true,
      ...application,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`✅ Resume Editor backend on http://localhost:${PORT}`);
  });
}

export default app;

// ── Default resume data ──────────────────────────────────────────
function getDefaultResume() {
  return {
    personal: {
      nameEn: 'Mohamed Fuad',
      nameJa: 'モハメド フアド',
      furigana: 'もはめど ふあど',
      dob: '2004-02-28',
      address: '東京都世田谷区',
      phone: '080-7535-2988',
      email: 'mohamed.fuad.jp@gmail.com',
      linkedin: 'https://linkedin.com/in/mohamed-fuad-6b8483278',
      github: 'https://github.com/MohamedFuad16',
    },
    education: [
      {
        institution: 'Tokai University',
        institutionJa: '東海大学',
        location: 'Tokyo, Japan',
        degree: 'Bachelor of Science --- Information and Communication Technology',
        degreeJa: '情報通信学部 情報通信学科（学士課程・3年次在学中）',
        startDate: 'Apr 2024',
        endDate: 'Mar 2028 (Expected)',
        bullets: [
          '3rd Year student, School of Information Science and Technology',
          'Relevant Coursework: Data Structures & Algorithms, Computer Networks, Database Systems, Operating Systems, Software Engineering, Web Programming, Discrete Mathematics',
        ],
      },
    ],
    experience: [
      {
        company: 'Altius Link (formerly KDDI Evolva)',
        companyJa: 'アルティウスリンク株式会社',
        role: 'Translation Specialist',
        roleJa: '翻訳スペシャリスト',
        location: 'Tokyo, Japan',
        startDate: 'Jun 2023',
        endDate: 'Present',
        bullets: [
          'Translate customer communications for users of KDDI services, supporting bilingual customer service.',
          'Apply precise wording, cultural nuance, and professional communication under real customer-facing conditions.',
        ],
      },
      {
        company: 'Hotel SUI Akasaka',
        companyJa: 'ホテルSUI赤坂',
        role: 'Front Desk Associate',
        roleJa: 'フロントアソシエイト',
        location: 'Tokyo, Japan',
        startDate: 'Apr 2023',
        endDate: 'Jul 2023',
        bullets: [
          'Handled guest inquiries, reservations, check-in support, and front-desk service in English/Japanese environments.',
        ],
      },
      {
        company: 'Japan Airlines',
        companyJa: '日本航空株式会社',
        role: 'Immigration Specialist at Haneda Airport',
        roleJa: '出入国業務アシスタント',
        location: 'Tokyo, Japan',
        startDate: 'Feb 2023',
        endDate: 'Apr 2023',
        bullets: [
          'Assisted document registration, web-verification workflows, and passenger guidance using English/Japanese.',
        ],
      },
    ],
    projects: [
      {
        title: 'Tutor-System',
        tech: 'TypeScript, React 19, OpenRouter, Deepgram, Dexie/IndexedDB, Express',
        year: '2025',
        bullets: [
          'Built an AI learning interface for PDF reading, source-aware tutor chat, voice tutoring, and concept revision.',
          'Designed around study books, durable chat threads, and evidence-based learning progress.',
        ],
      },
      {
        title: 'TokaiHub',
        tech: 'TypeScript, React, Tailwind CSS, AWS Amplify, Cognito, Vite, PWA',
        year: '2025',
        bullets: [
          'Developed a central student portal PWA for Tokai University with mobile-first UI and bilingual support.',
          'Integrated custom AWS Cognito authentication and SES-backed OTP verification flows.',
        ],
      },
      {
        title: 'WebDrop',
        tech: 'HTML, CSS, JavaScript, Node.js, WebRTC, OPFS, Service Worker',
        year: '2024--2025',
        bullets: [
          'Built a mobile-first nearby file-sharing app using WebRTC RTCDataChannel and OPFS chunked streaming.',
          'Implemented ultrasonic Web Audio chirp exchange and motion sensors for proximity verification.',
        ],
      },
      {
        title: 'Codex Account Switcher',
        tech: 'Swift, AppKit, macOS Menu Bar, Process Control',
        year: '2025',
        bullets: [
          'Created a native macOS menu-bar utility to switch active Codex profiles and hot-swap session tokens.',
        ],
      },
    ],
    skills: {
      languages: 'TypeScript, JavaScript, Python, Swift, HTML/CSS, SQL, Java, C, Bash/Shell',
      frameworks: 'React, Node.js, Express, Flask, Tailwind CSS, SwiftUI, PWA, NumPy, Pandas',
      tools: 'Git, GitHub, AWS (Amplify/Cognito/SES), Docker, SQLite, MySQL, VS Code, Vim',
      concepts: 'RESTful APIs, OOP, Design Patterns, Data Structures, WebRTC, Network Protocols, Agile',
      spoken: 'English (Professional), Japanese (Business --- JLPT N2), Tamil (Native)',
    },
    activities: [
      {
        title: 'IEEE Student Member',
        org: 'Tokai University Student Branch',
        location: 'Tokyo, Japan',
        startDate: '2024',
        endDate: 'Present',
        bullets: ['Participated in technical seminars, workshops, and networking events in the ICT field.'],
      },
    ],
    summary: '東海大学情報通信学部情報通信学科の3年次に在学中（2024年4月入学、2028年3月卒業予定）。TypeScriptやReact、Node.jsを用いたモダンなWebアプリケーション開発や、SwiftによるmacOS向けのネイティブツール開発に取り組む。英語、日本語（JLPT N2）、タミル語（母語）のトリリンガルであり、アルティウスリンク株式会社では翻訳スペシャリストとして実務に従事。',
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
async function getApplications() {
  const stored = await store.getJson('applications', null);
  if (Array.isArray(stored)) return stored;
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
    await store.setJson('applications', list);
    return list;
  } catch (e) {
    console.error('Error reading applications:', e);
    return [];
  }
}

async function writeApplications(list) {
  await store.setJson('applications', list);
  if (process.env.VERCEL) return;
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
  const exp = r.experience?.[0] || {};
  return `Dear Hiring Team at ${company},

I am writing to express my strong interest in the ${jobTitle} position at ${company}. As a B.Sc. in ICT student at Tokai University with hands-on experience in full-stack development using TypeScript, React, and Swift, I am excited about the opportunity to contribute to your engineering goals.

During my studies and active projects, I have designed and built mobile-first web applications, integrated AI learning tools, and worked extensively with Node.js and AWS. Additionally, my professional experience as a Translation Specialist at ${exp.company || 'Altius Link'} has honed my bilingual communications in English and Japanese (JLPT N2), which will allow me to collaborate effectively in diverse technical environments.

Thank you for your time and consideration. I would welcome the opportunity to discuss how my technical skills and background align with the needs of ${company}.

Sincerely,
${p.nameEn || 'Mohamed Fuad'}
${p.email || 'mohamed.fuad.jp@gmail.com'} | ${p.phone || '080-7535-2988'}
`;
}
