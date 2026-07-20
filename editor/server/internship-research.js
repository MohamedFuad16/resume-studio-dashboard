import { createHash } from 'crypto';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const SCHEMA_FILE = fileURLToPath(new URL('./internship-search.schema.json', import.meta.url));
const BLOCKED_JOB_DOMAINS = /(?:indeed|glassdoor|linkedin|ziprecruiter|simplyhired)\./i;
// perplexity/sonar has native web search, returns sourced answers in a few
// seconds, and is cheaper per lookup than gpt-5-mini + OpenRouter's Exa plugin
// (which ran 120–245 s on the slow tail — see agent/errors.md). gpt-5-mini stays
// selectable as an accuracy-first fallback. Overridable via Settings/env.
const DEFAULT_MODEL = 'perplexity/sonar';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const slugify = value => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 52) || 'company';

// Built once — Intl.DateTimeFormat construction is expensive.
const TOKYO_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function todayInTokyo() {
  return TOKYO_YMD.format(new Date());
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || BLOCKED_JOB_DOMAINS.test(url.hostname)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function parseResult(raw) {
  const text = String(raw || '').trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Research agent did not return valid JSON');
    return JSON.parse(text.slice(start, end + 1));
  }
}

function normalizeResult(company, result, index, verifiedDate) {
  const url = safeUrl(result.url);
  const sourceUrl = safeUrl(result.sourceUrl);
  if (!url || !sourceUrl || !result.title?.trim()) return null;
  const location = result.location?.trim() || 'Not stated';
  const isJapan = /Japan|Tokyo|大阪|東京|京都|横浜/i.test(location);
  const scoreBase = isJapan ? 88 : /remote/i.test(`${location} ${result.workMode}`) ? 83 : 78;
  const fingerprint = createHash('sha1').update(`${company}|${result.title}|${url}`).digest('hex').slice(0, 10);
  const process = Array.isArray(result.applicationProcess) ? result.applicationProcess.filter(Boolean).slice(0, 8) : [];
  const codingText = result.codingTest === 'required'
    ? 'Coding test stated in the official process'
    : result.codingTest === 'not_required'
      ? 'Official process says no coding test'
      : 'No coding test stated on the official page';

  return {
    id: `live-${slugify(company)}-${fingerprint}`,
    company: company.trim(),
    role: result.title.trim(),
    location,
    region: isJapan ? 'Japan' : /remote/i.test(`${location} ${result.workMode}`) ? 'Remote' : 'APAC',
    country: isJapan ? 'Japan' : 'Not stated',
    city: /Tokyo|東京/i.test(location) ? 'Tokyo' : '',
    workMode: result.workMode?.trim() || 'Not stated',
    language: result.language?.trim() || 'Not stated',
    languageType: /Japanese/i.test(result.language || '') ? 'Bilingual' : 'English-first',
    duration: result.duration?.trim() || 'Not stated',
    deadline: result.deadline?.trim() || 'Not stated',
    deadlineDate: /^\d{4}-\d{2}-\d{2}$/.test(result.deadlineDate || '') ? result.deadlineDate : null,
    compensation: result.compensation?.trim() || 'Not stated',
    track: result.track?.trim() || 'Software Engineering',
    score: clamp(scoreBase + (result.codingTest === 'not_required' ? 3 : 0), 70, 94),
    priority: isJapan,
    workAuth: result.eligibility?.trim() || 'Re-check eligibility on the official page',
    reasons: [isJapan ? 'Japan-based official opening' : 'Official opening found by live research', codingText],
    // Keep the role description in `about` and give `fitNote` a genuine (non-duplicate)
    // fit statement — the detail panel renders these in separate sections. Phase 1.2.
    about: result.about?.trim() || '',
    fitNote: 'Surfaced by live company research as a match for your profile — confirm the responsibilities and eligibility on the official page before applying.',
    applicationProcess: process,
    codingTest: result.codingTest,
    url,
    source: result.sourceType === 'official_ats' ? 'Official applicant tracking page' : 'Official company careers page',
    sourceUrl,
    companyUrl: sourceUrl,
    // Only trust the posting host as the company's domain when it is NOT a job board /
    // ATS — otherwise the logo chip renders the board's favicon (e.g. HERP instead of
    // enechain). Blank lets the client fall back to its curated domain map or initials.
    companyDomain: (() => {
      try {
        const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
        return /greenhouse|lever\.co|workday|myworkdayjobs|ashbyhq|gaishishukatsu|herp\.careers|01intern|wantedly|onecareer|indeed\.|linkedin|talentio|hrmos|mynavi|rikunabi/.test(host) ? '' : host;
      } catch { return ''; }
    })(),
    logoUrl: '',
    verifiedDate,
    prestigeTier: 'Live company research',
    deadlineType: result.deadlineDate ? 'Fixed date shown on official page' : 'Not stated',
    researchIndex: index,
  };
}

function fallbackCompanyName(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'Company';
  if (/^[a-z0-9&.' -]+$/i.test(trimmed)) {
    return trimmed.split(/(\s+)/).map(part => {
      if (/\s+/.test(part) || !part) return part;
      if (/^[A-Z0-9&.'-]+$/.test(part)) return part;
      return `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`;
    }).join('');
  }
  return trimmed;
}

// Builds an OpenAI-SDK client pointed at OpenRouter. Throws a clearly-worded,
// taggable error when the key is missing so callers can degrade gracefully.
function getOpenRouterClient(overrideKey) {
  // Resolution order: per-user key from Settings (passed in) → env. See ADR-0016.
  const apiKey = (typeof overrideKey === 'string' && overrideKey.trim()) || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const error = new Error(
      'Live internship research is unavailable because OPENROUTER_API_KEY is not set. '
      + 'Add it to editor/.env.local for local dev and to the Vercel project environment for production, then retry.',
    );
    error.code = 'OPENROUTER_API_KEY_MISSING';
    throw error;
  }
  return new OpenAI({
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey,
    maxRetries: 1,
    defaultHeaders: {
      'HTTP-Referer': process.env.RESUME_STUDIO_APP_ORIGIN || 'https://editor-omega-two.vercel.app',
      'X-Title': 'Internship Portal',
    },
  });
}

let schemaCache = null;
async function loadSearchSchema() {
  if (!schemaCache) {
    const raw = JSON.parse(await fs.readFile(SCHEMA_FILE, 'utf8'));
    delete raw.$schema; // Not part of the API json_schema payload.
    schemaCache = raw;
  }
  return schemaCache;
}

// Web search sourcing:
//  - Perplexity `sonar*` models are natively web-connected — appending `:online`
//    is wrong (it would add the paid Exa plugin on top of Perplexity's own search).
//  - Everything else gets OpenRouter's `:online` web-search shortcut.
//  - A slug the operator already qualified with a `:variant` is left untouched.
export function researchModel(overrideModel) {
  const base = (typeof overrideModel === 'string' && overrideModel.trim()) || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  if (base.includes(':')) return base;
  if (/^perplexity\//i.test(base)) return base;
  return `${base}:online`;
}

function extractContent(response) {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content.map(part => (typeof part === 'string' ? part : part?.text || '')).join('').trim();
    if (text) return text;
  }
  throw new Error('Research model returned an empty response');
}

// Detects routes/models that reject strict json_schema so we can retry with
// plain json_object mode (handled by the tolerant parseResult below).
function isStructuredOutputRejection(error) {
  const status = error?.status;
  const message = String(error?.message || '').toLowerCase();
  return status === 400 || status === 404
    || /json_schema|response_format|structured|schema|strict|not support|no endpoints/.test(message);
}

async function runOpenAiSearch(prompt, { timeoutMs, apiKey, searchModel }) {
  const client = getOpenRouterClient(apiKey);
  const schema = await loadSearchSchema();
  const model = researchModel(searchModel);
  const messages = [
    {
      role: 'system',
      content: 'You are a live internship research agent for Internship Portal. Use web search to find only '
        + 'currently open, official postings. Respond with ONLY a JSON object that conforms to this JSON '
        + `schema — no prose, no markdown fences:\n${JSON.stringify(schema)}`,
    },
    { role: 'user', content: prompt },
  ];
  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages,
        response_format: { type: 'json_schema', json_schema: { name: 'internship_search', strict: true, schema } },
      },
      { timeout: timeoutMs },
    );
    return extractContent(response);
  } catch (error) {
    if (!isStructuredOutputRejection(error)) throw error;
    const response = await client.chat.completions.create(
      { model, messages, response_format: { type: 'json_object' } },
      { timeout: timeoutMs },
    );
    return extractContent(response);
  }
}

// Post-result verification: confirm the official posting URL actually resolves
// live (2xx/3xx, redirects followed) so the UI never surfaces a stale/fake link.
async function verifyUrlLive(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; ResumeStudioBot/1.0; +https://editor-omega-two.vercel.app)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    try { await response.body?.cancel(); } catch { /* best-effort: avoid downloading the body */ }
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

export async function researchCompanyInternships({ company, resume, rootDir, apiKey, searchModel }) {
  const verifiedDate = todayInTokyo();
  const profile = {
    education: (resume?.education || []).slice(0, 1),
    projects: (resume?.projects || []).map(item => ({ title: item.title, tech: item.tech })).slice(0, 5),
    skills: resume?.skills || {},
    languages: resume?.skills?.spoken || '',
    graduation: 'March 2028',
    location: 'Tokyo, Japan',
  };
  const prompt = `Act as a current internship research sub-agent for Internship Portal. Today is ${verifiedDate}. Search the live web for currently open internships or student programs at the company named below.

Company: ${company}
Candidate profile: ${JSON.stringify(profile)}

Search priorities:
1. Tokyo or elsewhere in Japan.
2. Remote roles explicitly open to a Japan-based student.
3. APAC roles only when the official page shows plausible eligibility.
4. Prefer English-first roles and straightforward applications. Do not claim an application has no coding test unless the official process explicitly says so; otherwise use codingTest = "not_stated".

Evidence rules:
- Set the top-level "company" field to the official company or brand capitalization shown by the employer, not necessarily the user's typed query.
- Include only openings verified on an official company careers page or the company's official ATS page.
- Include any currently open official internship/student-program result before judging profile fit, including sales, business, product, marketing, design, support, data, and engineering internships.
- Do not exclude a role merely because it is not a software-engineering internship; set the track accordingly and let the match score be lower in the app.
- CRITICAL — only include a posting whose page CURRENTLY shows it is OPEN. Reject anything showing closed/ended/expired markers such as "終了", "受付終了", "募集終了", "開催終了", "Closed", "No longer accepting", or a past deadline. When unsure whether it is still open, exclude it.
- Use the company's OWN official careers page or official ATS (e.g. Greenhouse, Lever, Workday, Ashby, careers.<company>.com). NEVER return a third-party aggregator/job-board link — explicitly exclude gaishishukatsu.com (外資就活), internship-guide (インターンシップガイド), rikunabi, mynavi, wantedly job listings, indeed, glassdoor, linkedin/jobs, and similar. If the only source is an aggregator, exclude the result.
- The "url" MUST be the direct official apply/detail page for THAT specific posting.
- Never invent deadlines, duration, language, compensation, eligibility, or stages. Use "Not stated" when absent.
- If no qualifying OPEN official opening is verified, return an empty results array and say so in summary.
- Return at most 6 results matching the provided output schema.`;
  // gpt-5-mini with :online web search realistically takes 120–245 s; give the call
  // headroom past that so a slow-but-valid search completes instead of erroring out
  // ("search failed"). Override with INTERNSHIP_RESEARCH_TIMEOUT_MS.
  const timeoutMs = Number(process.env.INTERNSHIP_RESEARCH_TIMEOUT_MS || 280000);
  let parsed;
  try {
    parsed = parseResult(await runOpenAiSearch(prompt, { timeoutMs, apiKey, searchModel }));
  } catch (error) {
    // Preserve the taggable code so the client can show an "add your key" CTA
    // instead of a raw error string. See Phase 3 / ADR-0016.
    if (error.code === 'OPENROUTER_API_KEY_MISSING') {
      console.warn('[internship-research] No OpenRouter key (Settings or env); live research disabled.');
      const wrapped = new Error('Add your OpenRouter API key in Settings to run live research.');
      wrapped.code = 'OPENROUTER_API_KEY_MISSING';
      throw wrapped;
    }
    throw new Error(`Live research agent failed: ${error.message}`);
  }
  const officialCompany = fallbackCompanyName(parsed.company || company);
  // One pass, capped at 8 keepers.
  const normalizedResults = [];
  const rawResults = Array.isArray(parsed.results) ? parsed.results : [];
  for (let index = 0; index < rawResults.length && normalizedResults.length < 8; index++) {
    const normalized = normalizeResult(officialCompany, rawResults[index], index, verifiedDate);
    if (normalized) normalizedResults.push(normalized);
  }

  // Verify every candidate posting is a live page before accepting it.
  const linkTimeoutMs = Number(process.env.INTERNSHIP_RESEARCH_LINK_TIMEOUT_MS || 8000);
  const liveness = await Promise.all(normalizedResults.map(result => verifyUrlLive(result.url, linkTimeoutMs)));
  const results = normalizedResults.filter((_, index) => liveness[index]);

  if (normalizedResults.length > 0 && results.length === 0) {
    throw new Error(
      'Live research found postings, but none of their official URLs responded as live (they may have just closed). '
      + 'Please try again shortly.',
    );
  }

  return {
    company: officialCompany,
    searchedAt: new Date().toISOString(),
    summary: String(parsed.summary || (results.length ? `Found ${results.length} verified opening(s).` : 'No verified openings found.')),
    results,
  };
}
