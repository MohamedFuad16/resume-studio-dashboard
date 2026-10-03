// Sample-data implementation of the v2 data layer (see ./index.js). Runs in the
// browser, keeps its state in localStorage, and never invents facts about real
// companies: unknown company details stay empty, and a selection flow that is
// not from research is returned as `typical`, which the UI labels as such.
import { parseSearchQuery } from '../../utils/searchQuery.js';
import { masterProfileFromResume, tailorDocument, suggestFormat } from '../../documents/tailor.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
};
const newId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

// ── Companies ─────────────────────────────────────────────────────────
// Common selection flows in Japan, shown only when there is no research for a
// company yet. Labelled "typical" in the UI; never presented as the company's own.
const TYPICAL_STEPS = {
  internship: [
    ['Entry form / entry sheet', 'エントリー・ES提出'],
    ['Web test or coding test', 'Webテスト・コーディングテスト'],
    ['Interview', '面接'],
    ['Final interview', '最終面接'],
    ['Internship offer', '参加決定'],
  ],
  new_grad: [
    ['Entry', 'エントリー'],
    ['Company briefing', '会社説明会'],
    ['Entry sheet', 'エントリーシート提出'],
    ['Web test', 'Webテスト'],
    ['First interview', '一次面接'],
    ['Second interview', '二次面接'],
    ['Final interview', '最終面接'],
    ['Offer (naitei)', '内定'],
  ],
  full_time: [
    ['Application', '応募'],
    ['Document screening', '書類選考'],
    ['Technical interview', '技術面接'],
    ['Final interview', '最終面接'],
    ['Offer', '内定'],
  ],
};

export const companyApi = {
  async get(name, { jobType = 'internship' } = {}) {
    await delay(200);
    const steps = (TYPICAL_STEPS[jobType] || TYPICAL_STEPS.internship).map(([en, ja]) => ({ title: en, titleJa: ja }));
    return { name, summary: '', summaryJa: '', whyFit: [], steps, stepsSource: 'typical', researchedAt: null };
  },
};

// ── Search ────────────────────────────────────────────────────────────
export const searchApi = {
  // The rule-based parser is the whole implementation here; phase 2 adds an LLM
  // in front of it and keeps this as the fallback.
  async parse(query) {
    return parseSearchQuery(query);
  },
  async web(query) {
    await delay(900);
    return { query, results: [], status: 'not_connected' };
  },
};

// ── Documents ─────────────────────────────────────────────────────────
const DOCS_KEY = 'internship-portal:documents:v1';

export const documentsApi = {
  async master(resume) {
    return masterProfileFromResume(resume);
  },
  suggest(job, profile) {
    return suggestFormat(job, profile);
  },
  async generate({ resume, job, lang, kind }) {
    await delay(700);
    const doc = tailorDocument({ profile: masterProfileFromResume(resume), job, lang, kind });
    return { ...doc, id: newId('doc'), source: 'sample', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  },
  async list() {
    return read(DOCS_KEY, []);
  },
  async save(doc) {
    const docs = read(DOCS_KEY, []).filter(entry => entry.id !== doc.id);
    const saved = { ...doc, updatedAt: new Date().toISOString() };
    write(DOCS_KEY, [saved, ...docs].slice(0, 50));
    return saved;
  },
  async remove(id) {
    write(DOCS_KEY, read(DOCS_KEY, []).filter(entry => entry.id !== id));
    return { ok: true };
  },
  // The phase 2 server renders the same HTML with headless Chromium and returns
  // a PDF. Without it, the caller falls back to the browser's print dialog.
  async pdf() {
    return { mode: 'print' };
  },
};

// ── Gmail accounts ────────────────────────────────────────────────────
const MAILBOX_KEY = 'internship-portal:mailboxes:v1';
const MAILBOX_SETTINGS_KEY = 'internship-portal:mailbox-settings:v1';
export const DEFAULT_MAILBOX_SETTINGS = { windowDays: 30, everyHours: 3, types: ['internship', 'new_grad'], paused: false };

export const mailboxesApi = {
  async list() {
    await delay(150);
    return read(MAILBOX_KEY, []);
  },
  // Phase 2 returns a Google consent URL. Here the address is taken as typed and
  // marked as a sample row: nothing is really connected.
  async add(email) {
    await delay(500);
    const address = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.');
    const list = read(MAILBOX_KEY, []);
    if (list.some(box => box.email === address)) throw new Error('That account is already linked.');
    const box = { id: newId('mbx'), email: address, status: 'connected', lastSyncAt: null, applicationsFound: 0, addedAt: new Date().toISOString(), sample: true };
    write(MAILBOX_KEY, [...list, box]);
    return box;
  },
  async remove(id) {
    write(MAILBOX_KEY, read(MAILBOX_KEY, []).filter(box => box.id !== id));
    return { ok: true };
  },
  async syncNow(id) {
    await delay(1200);
    const list = read(MAILBOX_KEY, []).map(box => (!id || box.id === id ? { ...box, lastSyncAt: new Date().toISOString() } : box));
    write(MAILBOX_KEY, list);
    return list;
  },
  async getSettings() {
    return { ...DEFAULT_MAILBOX_SETTINGS, ...read(MAILBOX_SETTINGS_KEY, {}) };
  },
  async saveSettings(patch) {
    const next = { ...DEFAULT_MAILBOX_SETTINGS, ...read(MAILBOX_SETTINGS_KEY, {}), ...patch };
    write(MAILBOX_SETTINGS_KEY, next);
    return next;
  },
};
