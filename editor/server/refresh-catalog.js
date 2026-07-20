// Self-healing daily catalog refresh.
//
// Runs on a schedule (see .github/workflows/validate-catalog.yml). Two passes,
// both writing ONLY to seeds/auto-refresh.json (regenerated wholesale — never
// touches the hand-formatted seed arrays):
//
//   1. RETIRE — every active listing whose apply/source URL is HTTP-dead
//      (404/410/dead-redirect, from the shared liveness checker). When an
//      OPENROUTER key is present, each candidate is double-checked with the
//      search model (perplexity/sonar): a listing is retired only if the LLM
//      does NOT clearly say it is still open (an HTTP-dead + LLM-"still open"
//      conflict is logged for a human, not auto-retired).
//
//   2. DEADLINE — stale-risk listings (deadline soon / verified long ago) get
//      their current deadline re-checked with the search model; a changed date
//      is written as a patch. Capped by MAX_LLM_CALLS so cost stays bounded.
//
// Exit code: 0 on success (a run that self-heals is a GREEN run — the workflow
// opens a PR with the diff). Non-zero only on an infrastructure crash.
//
// Usage:
//   node server/refresh-catalog.js            # full run (needs network; LLM if key set)
//   node server/refresh-catalog.js --dry-run  # compute + print, do not write the JSON
//   node server/refresh-catalog.js --no-llm   # HTTP-only (skip all model calls)
import fs from 'fs';
import OpenAI from 'openai';
import { buildSeedCatalog } from './seeds/catalog.js';
import { linkCheck } from './validate-catalog.js';
import { AUTO_REFRESH_PATH, autoRefreshData } from './seeds/auto-refresh.js';

const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has('--dry-run');
const API_KEY = process.env.OPENROUTER_API_KEY;
const USE_LLM = !ARGS.has('--no-llm') && Boolean(API_KEY);
const SEARCH_MODEL = process.env.OPENROUTER_MODEL || 'perplexity/sonar';
const MAX_LLM_CALLS = Number(process.env.REFRESH_MAX_LLM_CALLS || 200);
const LLM_TIMEOUT_MS = Number(process.env.REFRESH_LLM_TIMEOUT_MS || 45000);
const LLM_CONCURRENCY = Number(process.env.REFRESH_LLM_CONCURRENCY || 4);
const STALE_DEADLINE_DAYS = Number(process.env.REFRESH_STALE_DEADLINE_DAYS || 14);
const VERIFIED_AGE_DAYS = Number(process.env.REFRESH_VERIFIED_AGE_DAYS || 21);

const now = new Date();
const todayIso = now.toISOString().slice(0, 10);
let llmCalls = 0;

const oai = USE_LLM ? new OpenAI({ baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1', apiKey: API_KEY }) : null;

function daysUntil(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
  return Math.round((new Date(dateStr + 'T00:00:00Z') - now) / 86400000);
}
function daysSince(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.round((now - d) / 86400000);
}

async function mapPool(items, size, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) || 1 }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await worker(items[i], i);
    }
  }));
  return out;
}

// Ask the search model a tight JSON question; returns null on any failure so the
// caller can degrade gracefully (never throws the whole run).
async function askModel(prompt) {
  if (!oai || llmCalls >= MAX_LLM_CALLS) return null;
  llmCalls += 1;
  try {
    const resp = await oai.chat.completions.create(
      {
        model: SEARCH_MODEL,
        messages: [
          { role: 'system', content: 'You verify whether internship postings are still open using live web search. Be conservative and cite a source URL. Answer ONLY minified JSON.' },
          { role: 'user', content: prompt },
        ],
      },
      { timeout: LLM_TIMEOUT_MS },
    );
    const text = resp.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (error) {
    console.warn(`  ! model call failed: ${error.message}`);
    return null;
  }
}

async function confirmDead(item) {
  const parsed = await askModel(
    `Today is ${todayIso}. Is this internship still open for applications right now?\n` +
    `Company: ${item.company}\nRole: ${item.role}\nKnown posting URL (may be dead): ${item.url}\n` +
    `Answer ONLY JSON: {"stillOpen":"yes"|"no"|"unknown","evidenceUrl":string,"note":string}.`,
  );
  if (!parsed) return { verdict: 'unconfirmed', evidenceUrl: '', note: 'no LLM verdict' };
  const stillOpen = ['yes', 'no', 'unknown'].includes(parsed.stillOpen) ? parsed.stillOpen : 'unknown';
  return { verdict: stillOpen, evidenceUrl: String(parsed.evidenceUrl || '').slice(0, 300), note: String(parsed.note || '').slice(0, 300) };
}

async function checkDeadline(item) {
  const parsed = await askModel(
    `Today is ${todayIso}. What is the current application deadline for this internship?\n` +
    `Company: ${item.company}\nRole: ${item.role}\nPosting URL: ${item.url}\nDeadline on record: ${item.deadline || 'Not stated'}\n` +
    `Answer ONLY JSON: {"deadline":string,"deadlineDate":"YYYY-MM-DD"|null,"changed":true|false,"evidenceUrl":string}.\n` +
    `Set changed=false unless you found a specific different date on an official source.`,
  );
  if (!parsed || parsed.changed !== true) return null;
  const deadlineDate = /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadlineDate || '') ? parsed.deadlineDate : null;
  const deadline = String(parsed.deadline || '').slice(0, 120);
  if (!deadline && !deadlineDate) return null;
  if (deadline === item.deadline && deadlineDate === (item.deadlineDate || null)) return null;
  return { deadline: deadline || item.deadline, deadlineDate, verifiedDate: todayIso, note: `auto-refresh ${todayIso}`, evidenceUrl: String(parsed.evidenceUrl || '').slice(0, 300) };
}

function writeSummary(lines) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;
  try { fs.appendFileSync(summaryFile, lines.join('\n') + '\n'); } catch { /* best effort */ }
}

async function main() {
  const catalog = buildSeedCatalog();
  console.log(`\n[catalog refresh] ${todayIso} · ${catalog.length} active listings · LLM ${USE_LLM ? `on (${SEARCH_MODEL})` : 'off'}`);

  // ── Pass 1: retire HTTP-dead listings ────────────────────────────────
  const links = await linkCheck(catalog);
  const broken = links.filter(l => l.hard);
  const brokenIds = new Set();
  for (const link of broken) for (const use of link.usedBy) brokenIds.add(use.id);
  const brokenEntries = catalog.filter(item => brokenIds.has(item.id));
  console.log(`Pass 1 — liveness: ${links.length} URLs · ${broken.length} broken → ${brokenEntries.length} candidate listing(s)`);

  const newlyRetired = [];
  const conflicts = [];
  for (const item of brokenEntries) {
    let verdict = { verdict: 'unconfirmed', evidenceUrl: '', note: 'HTTP-dead; LLM off' };
    if (USE_LLM) verdict = await confirmDead(item);
    if (verdict.verdict === 'yes') {
      conflicts.push({ id: item.id, company: item.company, role: item.role, note: verdict.note, evidenceUrl: verdict.evidenceUrl });
      console.log(`  ~ CONFLICT ${item.id} (${item.company}) — HTTP-dead but model says still open; left active for review`);
      continue;
    }
    newlyRetired.push({
      id: item.id, company: item.company, role: item.role,
      retiredAt: todayIso,
      reason: `apply URL HTTP-dead${USE_LLM ? ` · model: ${verdict.verdict}` : ''}`.slice(0, 200),
      evidenceUrl: verdict.evidenceUrl || item.url,
    });
    console.log(`  ✗ RETIRE ${item.id} (${item.company} — ${item.role})`);
  }

  // ── Pass 2: refresh deadlines for stale-risk listings ────────────────
  const deadlinePatches = {};
  if (USE_LLM) {
    const activeAfterRetire = catalog.filter(item => !newlyRetired.some(r => r.id === item.id));
    const staleRisk = activeAfterRetire.filter(item => {
      const du = daysUntil(item.deadlineDate);
      return (du !== null && du >= 0 && du <= STALE_DEADLINE_DAYS) || daysSince(item.verifiedDate) > VERIFIED_AGE_DAYS;
    });
    console.log(`Pass 2 — deadlines: ${staleRisk.length} stale-risk listing(s) (budget left: ${Math.max(0, MAX_LLM_CALLS - llmCalls)} calls)`);
    const results = await mapPool(staleRisk, LLM_CONCURRENCY, async item => ({ id: item.id, patch: await checkDeadline(item) }));
    for (const r of results) {
      const { patch } = r;
      if (patch) {
        deadlinePatches[r.id] = { deadline: patch.deadline, deadlineDate: patch.deadlineDate, verifiedDate: patch.verifiedDate, note: patch.note };
        console.log(`  ↻ DEADLINE ${r.id} → ${patch.deadline}${patch.deadlineDate ? ` (${patch.deadlineDate})` : ''}`);
      }
    }
  } else {
    console.log('Pass 2 — deadlines: skipped (LLM off)');
  }

  // ── Merge into the machine-owned overlay ─────────────────────────────
  const mergedRetiredMap = new Map(autoRefreshData.retired.map(r => [r.id, r]));
  for (const r of newlyRetired) mergedRetiredMap.set(r.id, r);
  const mergedDeadlines = { ...autoRefreshData.deadlinePatches, ...deadlinePatches };
  const next = {
    updatedAt: todayIso,
    retired: [...mergedRetiredMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    deadlinePatches: mergedDeadlines,
  };

  const changed = newlyRetired.length > 0 || Object.keys(deadlinePatches).length > 0;
  const summary = [
    `## Catalog auto-refresh — ${todayIso}`,
    '',
    `- Active listings scanned: **${catalog.length}**`,
    `- Retired this run: **${newlyRetired.length}**${newlyRetired.length ? ' — ' + newlyRetired.map(r => `${r.company} (${r.id})`).join(', ') : ''}`,
    `- Deadlines updated: **${Object.keys(deadlinePatches).length}**${Object.keys(deadlinePatches).length ? ' — ' + Object.keys(deadlinePatches).join(', ') : ''}`,
    `- Conflicts (HTTP-dead but model says open, left active): **${conflicts.length}**${conflicts.length ? ' — ' + conflicts.map(c => c.id).join(', ') : ''}`,
    `- LLM calls used: **${llmCalls}** / ${MAX_LLM_CALLS}`,
    '',
    changed ? '✅ Changes written to `seeds/auto-refresh.json`.' : 'ℹ️ No changes — catalog is healthy.',
  ];
  console.log('\n' + summary.join('\n'));
  writeSummary(summary);

  if (DRY_RUN) {
    console.log('\n[dry-run] not writing auto-refresh.json');
  } else if (changed) {
    fs.writeFileSync(AUTO_REFRESH_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`\nWrote ${AUTO_REFRESH_PATH}`);
  }

  // Expose whether anything changed for the workflow (drives PR creation).
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed ? 'true' : 'false'}\n`);
  }
}

main().catch(error => {
  console.error('refresh-catalog crashed:', error);
  process.exit(2);
});
