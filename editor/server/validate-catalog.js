#!/usr/bin/env node
// Automated internship-catalog validator.
//
// Runs three independent checks and prints a per-entry pass/fail report:
//   1. FORMATTING  — required fields present, correct types/shapes, aligned with
//                    server/validation.js (`validateInternship`); flags duplicate
//                    ids and duplicated list items (eligibility/reasons/techStack).
//   2. DB ROUND-TRIP — saves the validated catalog through server/storage.js
//                    (a throwaway local sql.js DB), reads it back, and asserts
//                    structural equality so we know data is "properly formatted,
//                    sent, and received" with no corruption.
//   3. LINK LIVENESS (optional, network) — `--links` or VALIDATE_LINKS=1 fetches
//                    every apply/source URL (GET, follow redirects) and flags
//                    4xx/5xx/timeouts/non-HTTPS/malformed.
//
// Usage:
//   node server/validate-catalog.js            # formatting + DB round-trip
//   node server/validate-catalog.js --links    # + link liveness (needs network)
//   node server/validate-catalog.js --links --json > report.json
//
// Exit code is 0 only when there are no hard failures, so it is safe to wire into
// CI / the daily ingestion flow. Link "warnings" (e.g. 401/403/405/429 bot walls)
// do not fail the run; hard link failures (404/410/5xx/DNS/timeout) do.
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSeedCatalog } from './seeds/catalog.js';
import { validateInternship, RequestValidationError } from './validation.js';
import { createStore } from './storage.js';

const ARGS = new Set(process.argv.slice(2));
const CHECK_LINKS = ARGS.has('--links') || process.env.VALIDATE_LINKS === '1';
const AS_JSON = ARGS.has('--json');
const LINK_TIMEOUT_MS = Number(process.env.VALIDATE_LINK_TIMEOUT_MS || 15000);
const LINK_CONCURRENCY = Number(process.env.VALIDATE_LINK_CONCURRENCY || 8);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LANGUAGE_TYPES = new Set(['English-first', 'Bilingual']);
const STRING_ARRAY_FIELDS = ['reasons', 'eligibility', 'eligibilityJa', 'techStack', 'applicationProcess', 'applicationProcessJa'];
// Hosts known to bot-wall automated GETs; a non-2xx from these is a warning, not a failure.
const SOFT_FAIL_STATUSES = new Set([401, 403, 405, 408, 429, 999]);
// ATS "soft 404" signatures: the URL returns 200 but redirects to a not-found /
// expired-job landing page. Treated as a hard failure (the apply link is dead).
const DEAD_REDIRECT_RE = /[?&](error|not_found)=true\b|\/not[-_]?found\b|job[-_]?not[-_]?found/i;

// Heuristic for "the apply URL points at a generic careers/program landing page
// rather than the specific posting for THAT role". This is a SOFT signal only:
// it never fails the run, it just surfaces entries worth a manual deep-link check.
// Hosts that are ATS/job-boards and therefore always deep-link to one posting.
const SPECIFIC_HOST_RE = /(greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|workable\.com|jobvite\.com|smartrecruiters\.com|rippling\.com|oraclecloud\.com|talentio\.com|wantedly\.com)/i;
// Query params that identify a single posting (e.g. ?gh_jid=, ?id=, ?jobId=).
const SPECIFIC_QUERY_RE = /[?&](id|jid|gh_jid|jobid|job_id|posting|req|requisition|position_?id)=/i;

// Returns true when `rawUrl` looks like a generic landing page (bare domain, or a
// path made up only of words like /careers, /recruit, /internship with no job
// id/slug). Conservative on purpose: any digit-bearing path segment, known ATS
// host, or job-id query param is treated as a specific posting (no warning).
function looksGenericApplyUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return true;            // bare domain / root path
  if (SPECIFIC_HOST_RE.test(url.hostname)) return false;
  if (SPECIFIC_QUERY_RE.test(url.search)) return false;
  if (segments.some(seg => /\d/.test(seg))) return false; // a segment carries an id/slug
  return true;                                       // only generic landing words remain
}

function shapeErrors(item) {
  const errors = [];
  const warnings = [];
  // Hard requirements beyond validateInternship.
  if (item.deadlineDate != null && !DATE_RE.test(item.deadlineDate)) {
    errors.push(`deadlineDate must be null or YYYY-MM-DD (got ${JSON.stringify(item.deadlineDate)})`);
  }
  if (item.languageType && !LANGUAGE_TYPES.has(item.languageType)) {
    errors.push(`languageType must be English-first or Bilingual (got ${JSON.stringify(item.languageType)})`);
  }
  for (const field of STRING_ARRAY_FIELDS) {
    if (item[field] === undefined) continue;
    if (!Array.isArray(item[field])) {
      errors.push(`${field} must be an array when present`);
      continue;
    }
    if (item[field].some(entry => typeof entry !== 'string')) {
      errors.push(`${field} must contain only strings`);
    }
    const seen = new Set();
    for (const entry of item[field]) {
      const key = String(entry).trim().toLowerCase();
      if (key && seen.has(key)) {
        errors.push(`${field} has a duplicated item: ${JSON.stringify(entry)}`);
      }
      seen.add(key);
    }
  }
  if (item.score != null && (typeof item.score !== 'number' || item.score < 0 || item.score > 100)) {
    errors.push(`score must be a number 0-100 (got ${JSON.stringify(item.score)})`);
  }
  // Soft expectations (do not fail the run).
  if (!item.verifiedDate || !DATE_RE.test(item.verifiedDate)) warnings.push('missing/invalid verifiedDate (YYYY-MM-DD)');
  if (!item.region) warnings.push('missing region');
  if (!item.location) warnings.push('missing location');
  if (!item.track) warnings.push('missing track');
  if (item.url && looksGenericApplyUrl(item.url)) warnings.push(`generic-apply-url: ${item.url}`);
  return { errors, warnings };
}

function formatCheck(rawCatalog) {
  const results = [];
  const idCounts = new Map();
  const validated = [];
  for (const raw of rawCatalog) {
    const id = raw?.id || '(no id)';
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
    const entry = { id, company: raw?.company || '(no company)', errors: [], warnings: [] };
    let safe;
    try {
      safe = validateInternship(raw);
      validated.push(safe);
    } catch (error) {
      const message = error instanceof RequestValidationError ? error.message : (error?.message || String(error));
      entry.errors.push(`validation.js: ${message}`);
      results.push(entry);
      continue;
    }
    const { errors, warnings } = shapeErrors(safe);
    entry.errors.push(...errors);
    entry.warnings.push(...warnings);
    results.push(entry);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      for (const entry of results.filter(r => r.id === id)) {
        entry.errors.push(`duplicate id appears ${count}x in seed sources (dedup-by-id would drop ${count - 1})`);
      }
    }
  }
  return { results, validated };
}

async function dbRoundTrip(validated) {
  const localDbPath = path.join(os.tmpdir(), `resume-studio-validate-${randomUUID()}.sqlite`);
  // Force the local sqlite backend regardless of ambient Vercel/Blob env.
  const savedVercel = process.env.VERCEL;
  const savedBlob = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const store = createStore({ localDbPath });
  try {
    await store.init();
    await store.setJson('internships:catalog', validated);
    const loaded = await store.getJson('internships:catalog', null);
    const ok = JSON.stringify(loaded) === JSON.stringify(validated);
    let mismatch = '';
    if (!ok) {
      if (!Array.isArray(loaded)) mismatch = 'loaded value is not an array';
      else if (loaded.length !== validated.length) mismatch = `length ${loaded.length} != ${validated.length}`;
      else {
        const idx = validated.findIndex((item, i) => JSON.stringify(item) !== JSON.stringify(loaded[i]));
        mismatch = idx >= 0 ? `entry #${idx} (${validated[idx]?.id}) differs after round-trip` : 'unknown structural difference';
      }
    }
    return { ok, backend: store.backend, count: Array.isArray(loaded) ? loaded.length : 0, mismatch };
  } finally {
    if (savedVercel !== undefined) process.env.VERCEL = savedVercel;
    if (savedBlob !== undefined) process.env.BLOB_READ_WRITE_TOKEN = savedBlob;
    await import('node:fs/promises').then(fs => fs.rm(localDbPath, { force: true })).catch(() => {});
  }
}

async function checkUrl(url) {
  if (!/^https:\/\//i.test(url)) return { url, ok: false, hard: true, status: 0, note: 'not HTTPS / malformed' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
      },
    });
    const status = response.status;
    if (status >= 200 && status < 400 && DEAD_REDIRECT_RE.test(response.url || '')) {
      return { url, ok: false, hard: true, status, note: 'dead/expired (redirects to not-found page)', finalUrl: response.url };
    }
    if (status >= 200 && status < 400) return { url, ok: true, hard: false, status, note: 'ok', finalUrl: response.url };
    if (SOFT_FAIL_STATUSES.has(status)) return { url, ok: false, hard: false, status, note: 'blocked/needs manual check', finalUrl: response.url };
    return { url, ok: false, hard: true, status, note: `HTTP ${status}`, finalUrl: response.url };
  } catch (error) {
    const note = error.name === 'AbortError' ? `timeout >${LINK_TIMEOUT_MS}ms` : (error.cause?.code || error.message || 'network error');
    return { url, ok: false, hard: true, status: 0, note };
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool(items, size, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return out;
}

async function linkCheck(validated) {
  // De-duplicate URLs across apply + source links; remember which entries use each.
  const usage = new Map();
  for (const item of validated) {
    for (const [kind, url] of [['url', item.url], ['sourceUrl', item.sourceUrl]]) {
      if (!url) continue;
      if (!usage.has(url)) usage.set(url, []);
      usage.get(url).push({ id: item.id, company: item.company, kind });
    }
  }
  const urls = [...usage.keys()];
  const checks = await mapPool(urls, LINK_CONCURRENCY, checkUrl);
  return checks.map(check => ({ ...check, usedBy: usage.get(check.url) }));
}

function printText({ formatResults, roundTrip, links, hardFail }) {
  const line = '─'.repeat(72);
  console.log(`\n${line}\nINTERNSHIP CATALOG VALIDATION\n${line}`);
  let formatErrors = 0;
  let formatWarnings = 0;
  for (const entry of formatResults) {
    if (entry.errors.length) {
      formatErrors += entry.errors.length;
      console.log(`✗ ${entry.id} (${entry.company})`);
      entry.errors.forEach(message => console.log(`    ERROR  ${message}`));
      entry.warnings.forEach(message => console.log(`    warn   ${message}`));
    } else if (entry.warnings.length) {
      formatWarnings += entry.warnings.length;
    }
  }
  console.log(`\n[1] Formatting: ${formatResults.length} entries · ${formatErrors} error(s) · ${formatWarnings} warning(s)`);
  if (!formatErrors) console.log('    ✓ all entries pass validation.js + shape checks');

  // Soft (non-failing) heuristic: apply URLs that look like generic landing pages
  // rather than the specific posting for that role. Informational only.
  const genericUrlEntries = formatResults.filter(e => e.warnings.some(w => w.startsWith('generic-apply-url:')));
  if (genericUrlEntries.length) {
    console.log(`\n[1b] Likely-generic apply URLs (soft · ${genericUrlEntries.length}) — verify these deep-link to the specific posting:`);
    for (const entry of genericUrlEntries) {
      const url = (entry.warnings.find(w => w.startsWith('generic-apply-url:')) || '').replace('generic-apply-url: ', '');
      console.log(`    ⚠ ${entry.id} (${entry.company})  ${url}`);
    }
  }

  console.log(`\n[2] DB round-trip (${roundTrip.backend}): ${roundTrip.ok ? '✓ pass' : '✗ FAIL'} — ${roundTrip.count} entries${roundTrip.ok ? '' : ` — ${roundTrip.mismatch}`}`);

  if (links) {
    const hard = links.filter(l => l.hard);
    const soft = links.filter(l => !l.ok && !l.hard);
    const ok = links.filter(l => l.ok);
    console.log(`\n[3] Link liveness: ${links.length} unique URLs · ${ok.length} ok · ${soft.length} warn · ${hard.length} broken`);
    for (const l of hard) {
      console.log(`    ✗ BROKEN ${l.note}${l.status ? ` (${l.status})` : ''}  ${l.url}`);
      l.usedBy.forEach(u => console.log(`        used by ${u.id} (${u.company}) [${u.kind}]`));
    }
    for (const l of soft) {
      console.log(`    ⚠ ${l.note} (${l.status})  ${l.url}`);
      l.usedBy.forEach(u => console.log(`        used by ${u.id} (${u.company}) [${u.kind}]`));
    }
  } else {
    console.log('\n[3] Link liveness: skipped (pass --links or VALIDATE_LINKS=1 to enable)');
  }
  console.log(`\n${line}\n${hardFail ? '✗ VALIDATION FAILED' : '✓ VALIDATION PASSED'}\n${line}\n`);
}

async function main() {
  const rawCatalog = buildSeedCatalog();
  const { results: formatResults, validated } = formatCheck(rawCatalog);
  const roundTrip = await dbRoundTrip(validated);
  const links = CHECK_LINKS ? await linkCheck(validated) : null;

  const formatHardFail = formatResults.some(entry => entry.errors.length);
  const linkHardFail = Boolean(links && links.some(l => l.hard));
  const hardFail = formatHardFail || !roundTrip.ok || linkHardFail;

  if (AS_JSON) {
    console.log(JSON.stringify({
      summary: {
        entries: formatResults.length,
        formatErrors: formatResults.reduce((n, e) => n + e.errors.length, 0),
        roundTripOk: roundTrip.ok,
        linksChecked: links ? links.length : 0,
        linksBroken: links ? links.filter(l => l.hard).length : 0,
        linksWarn: links ? links.filter(l => !l.ok && !l.hard).length : 0,
        pass: !hardFail,
      },
      formatResults: formatResults.filter(e => e.errors.length || e.warnings.length),
      roundTrip,
      links,
    }, null, 2));
  } else {
    printText({ formatResults, roundTrip, links, hardFail });
  }
  process.exit(hardFail ? 1 : 0);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch(error => {
    console.error('Validator crashed:', error);
    process.exit(2);
  });
}

export { formatCheck, dbRoundTrip, linkCheck, buildSeedCatalog };
