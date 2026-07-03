// audit-catalog-llm.js — daily cheap-LLM catalog validity audit (Phase 7).
//
// The mechanical validator (validate-catalog.js) proves shape + link liveness and
// may auto-fail on 404/410. This script goes one step further for entries that are
// mechanically alive but STALE-RISK (deadline within N days, verifiedDate older
// than N days, or a generic apply URL): it fetches the page text and asks a cheap
// "audit" model whether the posting is still open and whether the deadline changed.
//
// POLICY: this NEVER auto-retires an entry. LLM "closed" verdicts are written to a
// dated report for a human/agent to confirm — only mechanical 404/410 (in the other
// validator) may auto-retire. The report is advisory.
//
// Usage:
//   node server/audit-catalog-llm.js                 # audit all stale-risk entries
//   node server/audit-catalog-llm.js --limit 5       # cap the number of LLM calls
//   node server/audit-catalog-llm.js --dry           # candidate list only, no LLM
//   npm run audit:catalog:llm
//
// Key resolution: OPENROUTER_API_KEY (env). Without it the script prints the
// stale-risk candidate list, writes a report with null verdicts, and exits 0 (so
// CI stays green whether or not the secret is configured).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { buildSeedCatalog } from './seeds/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARGS = process.argv.slice(2);
const flag = name => ARGS.includes(name);
const argVal = (name, def) => { const i = ARGS.indexOf(name); return i >= 0 && ARGS[i + 1] ? ARGS[i + 1] : def; };

const DRY = flag('--dry');
const LIMIT = Number(argVal('--limit', process.env.LLM_AUDIT_LIMIT || '')) || Infinity;
const STALE_DAYS = Number(process.env.LLM_AUDIT_STALE_DAYS || 21);
const VERIFIED_AGE_DAYS = Number(process.env.LLM_AUDIT_VERIFIED_AGE_DAYS || 14);
const CONCURRENCY = Number(process.env.LLM_AUDIT_CONCURRENCY || 4);
const PAGE_TIMEOUT_MS = Number(process.env.LLM_AUDIT_PAGE_TIMEOUT_MS || 12000);
const LLM_TIMEOUT_MS = Number(process.env.LLM_AUDIT_LLM_TIMEOUT_MS || 60000);
const PAGE_TEXT_CHARS = Number(process.env.LLM_AUDIT_PAGE_CHARS || 6000);
const AUDIT_MODEL = process.env.LLM_AUDIT_MODEL || process.env.OPENROUTER_AUDIT_MODEL || 'openai/gpt-5-nano';
const API_KEY = process.env.OPENROUTER_API_KEY;

const now = new Date();
const todayIso = now.toISOString().slice(0, 10);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function daysUntil(dateStr) {
  if (!DATE_RE.test(dateStr || '')) return null;
  return Math.ceil((new Date(`${dateStr}T23:59:59+09:00`) - now) / 86400000);
}
function daysSince(dateStr) {
  if (!DATE_RE.test(dateStr || '')) return Infinity;
  return Math.floor((now - new Date(`${dateStr}T00:00:00+09:00`)) / 86400000);
}

// Same conservative heuristic as validate-catalog.js: a bare domain or an all-words
// path (no id/slug, not a known ATS host) reads as a generic landing page.
const SPECIFIC_HOST_RE = /(greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|workable\.com|jobvite\.com|smartrecruiters\.com|rippling\.com|oraclecloud\.com|talentio\.com|wantedly\.com)/i;
const SPECIFIC_QUERY_RE = /[?&](id|jid|gh_jid|jobid|job_id|posting|req|requisition|position_?id)=/i;
function looksGenericApplyUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return true;
  if (SPECIFIC_HOST_RE.test(url.hostname)) return false;
  if (SPECIFIC_QUERY_RE.test(url.search)) return false;
  if (segments.some(seg => /\d/.test(seg))) return false;
  return true;
}

function staleRisk(item) {
  const reasons = [];
  const du = daysUntil(item.deadlineDate);
  if (du !== null && du >= 0 && du <= STALE_DAYS) reasons.push(`deadline in ${du}d`);
  const vs = daysSince(item.verifiedDate);
  if (vs > VERIFIED_AGE_DAYS) reasons.push(`verified ${vs === Infinity ? 'never' : `${vs}d ago`}`);
  if (looksGenericApplyUrl(item.url)) reasons.push('generic apply URL');
  return reasons;
}

async function fetchPageText(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; ResumeStudioBot/1.0; +https://editor-omega-two.vercel.app)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return { ok: false, status: res.status, text: '' };
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, PAGE_TEXT_CHARS);
    return { ok: true, status: res.status, text };
  } catch (error) {
    return { ok: false, status: null, text: '', netError: error.message };
  }
}

function makeClient() {
  return new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: API_KEY,
    maxRetries: 1,
    defaultHeaders: { 'HTTP-Referer': 'https://editor-omega-two.vercel.app', 'X-Title': 'Internship Portal catalog audit' },
  });
}

const usage = { prompt: 0, completion: 0, total: 0, calls: 0 };

async function auditEntry(item, oai) {
  const page = await fetchPageText(item.url);
  const base = { id: item.id, company: item.company, role: item.role, url: item.url, httpStatus: page.status };
  if (!page.ok || !page.text) {
    return { ...base, stillOpen: 'unknown', deadlineChanged: null, note: page.netError ? `page fetch error: ${page.netError}` : `page not readable (HTTP ${page.status})` };
  }
  const record = { company: item.company, role: item.role, deadline: item.deadline, deadlineDate: item.deadlineDate, url: item.url };
  const prompt = `Today is ${todayIso}. Given the live page text and this catalog record, decide whether THIS internship/role is still open for applications, and whether the deadline shown on the page differs from the record.

Catalog record: ${JSON.stringify(record)}

Answer ONLY JSON: {"stillOpen": "yes" | "no" | "unknown", "deadlineChanged": string|null, "note": string}.
- "stillOpen": "no" only if the page clearly shows the posting is closed/expired/filled; "unknown" if the page is a generic careers/landing page that doesn't confirm this specific role.
- "deadlineChanged": the new deadline text if the page shows a different one, else null.
- "note": one short sentence of evidence.

Page text:
"""${page.text}"""`;
  const resp = await oai.chat.completions.create(
    {
      model: AUDIT_MODEL,
      messages: [
        { role: 'system', content: 'You are a careful internship-posting validity checker. Be conservative: only say "no" with clear evidence.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    },
    { timeout: LLM_TIMEOUT_MS },
  );
  if (resp.usage) { usage.prompt += resp.usage.prompt_tokens || 0; usage.completion += resp.usage.completion_tokens || 0; usage.total += resp.usage.total_tokens || 0; usage.calls += 1; }
  let parsed = {};
  try { parsed = JSON.parse(resp.choices?.[0]?.message?.content || '{}'); } catch { /* keep unknown */ }
  const stillOpen = ['yes', 'no', 'unknown'].includes(parsed.stillOpen) ? parsed.stillOpen : 'unknown';
  return { ...base, stillOpen, deadlineChanged: parsed.deadlineChanged || null, note: String(parsed.note || '').slice(0, 300) };
}

async function mapPool(items, size, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
    }
  }));
  return out;
}

async function main() {
  const catalog = buildSeedCatalog();
  const candidates = catalog
    .map(item => ({ item, reasons: staleRisk(item) }))
    .filter(c => c.reasons.length);

  console.log(`\n[LLM catalog audit] ${todayIso}`);
  console.log(`Catalog: ${catalog.length} entries · stale-risk candidates: ${candidates.length} (model: ${AUDIT_MODEL})`);
  for (const c of candidates.slice(0, 30)) {
    console.log(`  · ${c.item.company} — ${c.item.role}  [${c.reasons.join(', ')}]`);
  }
  if (candidates.length > 30) console.log(`  … and ${candidates.length - 30} more`);

  const reportPath = path.join(__dirname, 'seeds', `llm-audit-${todayIso}.json`);

  if (DRY || !API_KEY) {
    if (!API_KEY && !DRY) console.log('\nOPENROUTER_API_KEY not set — writing candidate list only (no LLM verdicts). Exit 0.');
    const report = {
      generatedAt: now.toISOString(), model: AUDIT_MODEL, catalogCount: catalog.length,
      candidateCount: candidates.length, audited: 0,
      results: candidates.map(c => ({ id: c.item.id, company: c.item.company, role: c.item.role, url: c.item.url, reasons: c.reasons, stillOpen: null })),
    };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Report written: ${reportPath}`);
    return;
  }

  const toAudit = candidates.slice(0, LIMIT === Infinity ? candidates.length : LIMIT);
  console.log(`\nAuditing ${toAudit.length} entr${toAudit.length === 1 ? 'y' : 'ies'} with the LLM (concurrency ${CONCURRENCY})…`);
  const oai = makeClient();
  const results = await mapPool(toAudit, CONCURRENCY, async ({ item, reasons }) => {
    try {
      const r = await auditEntry(item, oai);
      return { ...r, reasons };
    } catch (error) {
      return { id: item.id, company: item.company, role: item.role, url: item.url, reasons, stillOpen: 'unknown', deadlineChanged: null, note: `audit error: ${error.message}` };
    }
  });

  const closed = results.filter(r => r.stillOpen === 'no');
  const changed = results.filter(r => r.deadlineChanged);
  const report = {
    generatedAt: now.toISOString(), model: AUDIT_MODEL, catalogCount: catalog.length,
    candidateCount: candidates.length, audited: results.length,
    tokenUsage: usage, results,
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log('\n──────── summary ────────');
  console.log(`audited: ${results.length} · likely-closed (needs review): ${closed.length} · deadline-changed: ${changed.length}`);
  for (const r of closed) console.log(`  ✗ CLOSED? ${r.company} — ${r.role}: ${r.note}`);
  for (const r of changed) console.log(`  ⏰ ${r.company} — ${r.role}: deadline now "${r.deadlineChanged}"`);
  console.log(`tokens: ${usage.total} (prompt ${usage.prompt} + completion ${usage.completion}) over ${usage.calls} calls`);
  console.log(`Report written: ${reportPath}`);
  console.log('NOTE: LLM verdicts are advisory — no entry is auto-retired. Confirm before editing seeds.');
}

main().catch(error => {
  // Never fail CI on an audit-infrastructure error (the mechanical validator is the
  // hard gate). Log and exit 0 so a flaky network/model doesn't break the pipeline.
  console.error('[llm-audit] non-fatal error:', error.message);
  process.exit(0);
});
