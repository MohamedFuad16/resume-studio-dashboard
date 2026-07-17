// Email → structured application signal, and company enrichment.
//   • classifyMessage: cheap triage model (gpt-5-nano) decides whether an email
//     is about a job/internship application and extracts company/role/status/
//     interview date. Classification is easy, so this stays on the cheapest tier.
//   • enrichCompany: search model (perplexity/sonar) finds the official posting
//     URL + location + deadline for a company we don't already track.
import OpenAI from 'openai';

const TRIAGE_MODEL = process.env.OPENROUTER_AUDIT_MODEL || process.env.LLM_AUDIT_MODEL || 'openai/gpt-5-nano';
const SEARCH_MODEL = process.env.OPENROUTER_MODEL || 'perplexity/sonar';
const TIMEOUT_MS = Number(process.env.GMAIL_LLM_TIMEOUT_MS || 40000);

// Sync checks this up front: without a key, classification silently no-ops,
// which must surface as a skip — not as messages scanned and marked processed.
export const llmAvailable = () => Boolean(process.env.OPENROUTER_API_KEY);

let client = null;
function oai() {
  if (!process.env.OPENROUTER_API_KEY) return null;
  if (!client) client = new OpenAI({ baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
  return client;
}

function parseJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

const VALID_KINDS = new Set(['applied', 'rejected', 'interview', 'offer', 'other']);

// Roles and platforms that are never internships, whatever the triage model says.
//
// The prompt below already spells this rule out, and gpt-5-nano keeps answering
// isInternship=true anyway — a real 90-day backfill queued micro1's "Japanese
// Language Expert", 5CA's support mail and Turing's "LLM Trainer" as interviews.
// A rule we can state exactly should not be left to a cheap model's judgement, so
// the model proposes and this disposes. Every entry here corresponds to a wrong
// record observed in the real inbox.
const NON_INTERNSHIP_ROLE =
  /(language expert|ai (trainer|interview)|llm trainer|data annotat|annotator|labell?ing|crowdwork|freelanc|\bgig\b|tutor|customer (support|service|experience)|support (agent|specialist|engineer)|email analyst|content moderat|transcrib|survey taker|voice (actor|record)|quality analyst)/i;

// Platforms whose entire business is gig / outsourced work.
const NON_INTERNSHIP_COMPANY = /^(micro1|5ca|remotasks|appen|outlier)\b/i;

export function looksLikeGig(company, role) {
  return NON_INTERNSHIP_COMPANY.test(String(company || '').trim())
    || NON_INTERNSHIP_ROLE.test(String(role || ''));
}

// Returns null on any failure (never throws the sync). Shape:
// { isApplicationRelated, kind, company, role, interview:{date,time}|null, confidence }
export async function classifyMessage(message) {
  const ai = oai();
  if (!ai) return null;
  const prompt =
    `Classify this email about a job/internship application. Today is ${new Date().toISOString().slice(0, 10)}.\n\n` +
    `From: ${message.from}\nSubject: ${message.subject}\nBody:\n"""${(message.text || message.snippet || '').slice(0, 3500)}"""\n\n` +
    `Answer ONLY minified JSON:\n` +
    `{"isApplicationRelated":bool,"isInternship":bool,"kind":"applied|rejected|interview|offer|other","company":str,"role":str,` +
    `"interview":{"date":"YYYY-MM-DD","time":"HH:mm"|null}|null,"reapplyMonths":{"min":int,"max":int}|null,"confidence":0..1}\n` +
    `Rules: isApplicationRelated=true only for emails about the user's OWN application to a company — ` +
    `including applications made on the company's own site or a job board (the confirmation still lands here). ` +
    `Marketing, newsletters, generic job alerts, and security notices are false.\n` +
    `isInternship=true ONLY for an internship / co-op / new-grad program (インターン・インターンシップ・新卒採用). ` +
    `Freelance or gig work, crowdwork, LLM/data-annotation or "AI trainer" gigs, tutoring, part-time jobs, ` +
    `customer-support roles, and regular full-time positions are isInternship=false even when application-related.\n` +
    `kind:\n` +
    `- "applied": application confirmation / registration / pre-entry / "thank you for applying" / エントリー・応募完了.\n` +
    `- "interview": ANY selection step past "applied" — an interview invite/schedule, OR a coding test / online / ` +
    `technical assessment (e.g. Codility, HackerRank, "invites you to a test") / screening / 選考・コーディングテスト・Webテスト. ` +
    `Extract a date/time into "interview" if one is present (a coding-test deadline counts).\n` +
    `- "rejected": rejection / "not selected" / "selection result" that declines / 不合格・お見送り.\n` +
    `- "offer": an offer / 内定.\n` +
    `- "other": application-related but none of the above.\n` +
    `reapplyMonths: ONLY for a "rejected" email that states how long to WAIT before reapplying ` +
    `(e.g. "please apply again after 9-12 months", "you may reapply in 6 months", "再度のご応募は12ヶ月後以降"). ` +
    `Set {"min":9,"max":12} for a "9-12 months" range, {"min":6,"max":6} for a single "6 months". ` +
    `null when the email states no wait period. Convert "1 year"→12, "half a year"→6.\n` +
    `company/role empty string if unknown.`;
  try {
    const resp = await ai.chat.completions.create(
      {
        model: TRIAGE_MODEL,
        messages: [
          { role: 'system', content: 'You are a precise email classifier for a job-application tracker. Be conservative — when unsure, isApplicationRelated=false.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      },
      { timeout: TIMEOUT_MS },
    );
    const parsed = parseJson(resp.choices?.[0]?.message?.content);
    if (!parsed) return null;
    const kind = VALID_KINDS.has(parsed.kind) ? parsed.kind : 'other';
    const interview = parsed.interview && /^\d{4}-\d{2}-\d{2}$/.test(parsed.interview.date || '')
      ? { date: parsed.interview.date, time: /^\d{2}:\d{2}$/.test(parsed.interview.time || '') ? parsed.interview.time : null }
      : null;
    // Reapply window only meaningful for rejections. Clamp to a sane 1-36 month
    // range and ensure max ≥ min, so a hallucinated value can't block forever.
    let reapplyMonths = null;
    if (kind === 'rejected' && parsed.reapplyMonths && typeof parsed.reapplyMonths === 'object') {
      const toMonths = v => (Number.isFinite(v) && v > 0 ? Math.min(36, Math.round(v)) : null);
      const min = toMonths(parsed.reapplyMonths.min);
      const max = toMonths(parsed.reapplyMonths.max) ?? min;
      if (min) reapplyMonths = { min, max: Math.max(min, max || min) };
    }
    const company = String(parsed.company || '').slice(0, 120).trim();
    const role = String(parsed.role || '').slice(0, 160).trim();
    return {
      isApplicationRelated: Boolean(parsed.isApplicationRelated),
      // The deterministic guard overrides the model, never the reverse.
      isInternship: Boolean(parsed.isInternship) && !looksLikeGig(company, role),
      kind,
      company,
      role,
      interview,
      reapplyMonths,
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
    };
  } catch {
    return null;
  }
}

// Find the official posting for a company we don't already track. Returns null
// on failure. Shape: { url, location, deadline, deadlineDate }.
export async function enrichCompany(company, role) {
  const ai = oai();
  if (!ai || !company) return null;
  try {
    const resp = await ai.chat.completions.create(
      {
        model: SEARCH_MODEL,
        messages: [
          { role: 'system', content: 'You find official internship/job postings via web search. Prefer the company\'s own careers/ATS page over aggregators. Answer ONLY minified JSON.' },
          { role: 'user', content:
            `Find the official application page for this internship/job.\nCompany: ${company}\nRole: ${role || '(unspecified)'}\n` +
            `Answer ONLY JSON: {"url":str,"location":str,"deadline":str,"deadlineDate":"YYYY-MM-DD"|null}. ` +
            `Empty string / null if not found. Prefer the company careers or ATS URL, not LinkedIn/Indeed.` },
        ],
      },
      { timeout: TIMEOUT_MS },
    );
    const parsed = parseJson(resp.choices?.[0]?.message?.content);
    if (!parsed) return null;
    return {
      url: String(parsed.url || '').slice(0, 400).trim(),
      location: String(parsed.location || '').slice(0, 160).trim(),
      deadline: String(parsed.deadline || '').slice(0, 120).trim() || 'Not stated',
      deadlineDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadlineDate || '') ? parsed.deadlineDate : null,
    };
  } catch {
    return null;
  }
}
