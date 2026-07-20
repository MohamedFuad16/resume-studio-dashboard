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

// Internship detection is POSITIVE and GROUNDED, never a list of companies.
//
// The prompt already states the rule and gpt-5-nano answers isInternship=true
// anyway (a real 90-day backfill queued micro1's "Japanese Language Expert",
// 5CA's support mail and Turing's "LLM Trainer" as interviews). Naming those
// companies would be a denylist that ages badly and punishes a firm for its name
// rather than for what it wrote. So instead the model must QUOTE the words that
// make an email an internship, and we check the quote is really there:
//
//   1. the quote must appear in the email (no invention), and
//   2. the quote must actually contain an internship term.
//
// No quote → not an internship. A real internship email always says so somewhere;
// a gig email never does, whatever the model believes.
// Written to survive FOLDING (below), which turns "co-op" into "co op" and
// strips the 「」 around a Japanese quote — so the separators here accept a space.
const INTERNSHIP_TERM =
  /(intern(ship)?s?\b|co[-\s]?op\b|new[-\s.]?grad|graduate (programme|program|scheme)|placement year|サマーインターン|インターン(シップ)?|新卒|就業体験)/i;

/// Case- and space-insensitive, and — critically — punctuation-insensitive.
///
/// The containment check compares a model's quote against the email, and the two
/// disagree on punctuation constantly: the model returns `"Summer Internship
/// 2026."` with a trailing period, or wraps the span in quotes, or copies
/// 「サマーインターン」 with its Japanese brackets. Every one of those is a
/// faithful quote that a plain substring test rejects. Folding punctuation to
/// spaces keeps the guarantee that matters — the WORDS must really be in the
/// email — without failing over a full stop the model added itself.
const fold = text =>
  String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Bulk / mailing-list mail is not the user's application mail — and no amount of
// reading the body can tell you otherwise.
//
// On 2026-07-20 the classifier recorded "Revolut · Software Engineer (Java) ·
// interview" from Gmail message 19f6ffe0478300cf: a Reddit digest from
// noreply@redditmail.com quoting a STRANGER's post — "A Revolut recruiter
// contacted me on LinkedIn about the Graduate Programme 2027… I received a
// HackerRank assessment link". A fake company, a fake role, and an `interview`
// status invented from an email in which the word "interview" appears zero times.
//
// The internship quote-check did not help and could not have: it verifies that a
// quote is really IN the email, not whose experience the quote describes. That is
// the whole lesson — a digest is full of true sentences about other people's
// applications. So the guard runs BEFORE the classifier and keys on the envelope,
// not the prose:
//
//   • List-Unsubscribe / List-Id — the strongest single signal. RFC 2369 headers
//     mean the message was broadcast to a subscriber list. An ATS or a recruiter
//     writing to one candidate does not set them (transactional mail from Workday,
//     Greenhouse, Lever, SmartRecruiters and friends carries neither).
//   • List-Post — same family, an actual discussion list.
//   • Precedence: bulk | list | junk — the RFC 3834 marker for mass mail.
//
// Deliberately NOT a blocklist of sender names or domains: the owner's standing
// rule is that companies are never hardcoded anywhere, and a name list ages badly
// and punishes a firm for its name instead of for what it sent. A header rule
// states the actual property we care about — "this was addressed to a list, not
// to you" — and needs no maintenance.
const BULK_PRECEDENCE = /^\s*(bulk|list|junk)\s*$/i;
export function isBulkMail(message) {
  const bulk = message?.bulk || {};
  if (String(bulk.listUnsubscribe || '').trim()) return true;
  if (String(bulk.listId || '').trim()) return true;
  if (String(bulk.listPost || '').trim()) return true;
  return BULK_PRECEDENCE.test(String(bulk.precedence || ''));
}

/// True when `evidence` is a real quote from `haystack` AND names an internship.
export function internshipEvidenceHolds(evidence, haystack) {
  const quote = fold(evidence);
  if (quote.length < 4) return false;
  if (!INTERNSHIP_TERM.test(quote)) return false;
  return fold(haystack).includes(quote);
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic phrase evidence for `kind` (2026-07-20).
//
// The model could not read Japanese rejections. Verified against the owner's
// real inbox: 「【株式会社ABEJA】選考結果のご連絡」 and 「ご応募のお礼【AICE株式会社】」
// were rejections that never reached the tracker, and Ｓｋｙ株式会社's
// 「＜選考結果のご連絡＞」 was queued as an INTERVIEW. The owner had no interviews
// anywhere at the time.
//
// The failure is one of REGISTER, not of vocabulary. An English rejection says
// "unfortunately" and "we will not be moving forward". A Japanese one never
// states the decision directly — it says the company cannot "meet your wishes":
//
//   厳正なる選考の結果、誠に残念ながら今回は貴意に添いかねることとなりました
//   残念ながらご希望に沿えない結果となりました
//   今回のサマーインターンへの参加は見送らせていただくことになりました
//
// None of those contain a word that translates as "reject". A model tuned on
// English rejection cues reads them as neutral, or — because 選考 ("selection")
// is right there — as a selection STEP, i.e. an interview.
//
// So the model's `kind` is now overridden by verified phrase evidence wherever
// such evidence exists. Deterministic, testable, and cheap; the model keeps the
// cases the phrase tables say nothing about.
//
// Deliberately NOT keyed on senders or company names — the owner's standing rule.
// These are phrases of the LANGUAGE: every Japanese company's ATS writes them,
// and the tables need no maintenance when the owner applies somewhere new.
//
// Phrases are stored FOLDED (see fold) so they survive the same punctuation
// stripping the haystack gets — 「貴意に添いかね」 loses its brackets, "we're"
// becomes "we re", 「ご応募・選考」 loses its interpunct.

// A decision has been made and it is NEGATIVE. Highest precedence: a rejection
// is terminal and none of these phrases has a non-rejecting reading.
const REJECTION_PHRASES = [
  // ── Japanese. The polite indirect register, in its common inflections.
  '貴意に添いかね', '貴意に沿いかね',        // "cannot meet your esteemed wishes" (ABEJA, カナリー)
  'ご希望に沿えない', 'ご希望に添えない',      // "cannot meet your hopes" (AICE)
  'ご希望に沿えず', 'ご希望に添えず',
  'ご期待に沿えない', 'ご期待に添えない',      // "cannot meet your expectations"
  'ご期待に沿えず', 'ご期待に添えず',
  '見送らせていただ',                        // "we will refrain from proceeding" (enechain)
  '採用を見送', 'お見送り',
  '不合格',
  'ご縁がなかった', '縁がなかった',
  '通過されませんでした', '通過となりませんでした',
  '採用を見合わせ',
  // ── English. Conservative and high-precision; each states the decision.
  'we regret to inform',
  'not to move forward with your application',
  'we will not be moving forward',
  'move forward with another candidate',
  'move forward with other candidates',
  'we have decided not to proceed',
  'were not selected', 'have not been selected', 'not selected for',
  'unable to offer you',
  'will not be progressing',
  'decided not to move forward',
].map(fold);

// The subject announces a RESULT. 「選考結果」 means a decision has been made and
// is very often a rejection — it is NOT an interview invitation, which is the
// reading that put Ｓｋｙ株式会社 in the tracker as an interview.
//
// Checked against the SUBJECT only, deliberately. 「書類選考の結果、ぜひ面接にて…」
// ("as a result of the document screening, we'd love to interview you") is a real
// invitation and says 選考の結果 in its BODY — reading the body here would flip a
// genuine interview to a rejection.
const DECISION_NOTICE_SUBJECT = [
  '選考結果', '選考の結果', '審査結果', '選考結果のご連絡',
  'application results', 'application result',
  'selection result', 'result of your application',
].map(fold);

// Evidence that a selection STEP was actually invited or scheduled. Required
// before `interview` is allowed to stand.
//
// Note what is absent: a bare "coding test" / "coding challenge". HENNGE's
// admission challenge IS the application — "Thank you for applying… Please
// proceed to the coding test by registering from the link below" — and reading
// that as an interview is where the phantom interview action came from. A test
// only counts as a step past "applied" when the mail also INVITES or SCHEDULES
// it, or carries a date the model could extract.
const INTERVIEW_INVITATION_PHRASES = [
  // ── Japanese.
  '面接', '面談',
  '日程調整', '日程候補', 'ご都合のよい', 'ご都合の良い',
  '次の選考', '一次選考', '二次選考', '最終選考', '次選考',
  '選考にお進み', '選考のご案内',
  // ── English.
  'interview',
  'invite you to', 'invites you to', 'invited you to', 'would like to invite',
  'schedule a', 'scheduling a', 'book a time', 'pick a time', 'select a time',
  'next round', 'next stage', 'next step in the selection',
].map(fold);

// An offer is its own terminal outcome and must not be dragged to `rejected` by
// a decision-notice subject.
const OFFER_PHRASES = ['内定', '採用が決定', 'pleased to offer', 'happy to offer', 'offer of employment'].map(fold);

const firstMatch = (phrases, folded) => phrases.find(p => p && folded.includes(p)) || '';

/**
 * Override the model's `kind` with verified phrase evidence from the email.
 *
 * `subject` and `body` are the email's own text — every returned `evidence`
 * string is a phrase this function has just confirmed is present in it, so the
 * grounding guarantee that governs `internshipEvidence` holds here too: the
 * classifier never asserts a status the mail does not say.
 *
 * Precedence:
 *   1. a rejection phrase anywhere       → rejected
 *   2. a result-announcing SUBJECT, with no invitation evidence and no offer
 *                                        → rejected
 *   3. `interview` with no invitation evidence and no extracted date
 *                                        → applied (demoted, never dropped)
 *   otherwise the model's kind stands.
 *
 * (1) and (2) read the BODY as well as the subject, which is what fixes the
 * AICE shape: 「ご応募のお礼」 ("thank you for applying") reads as an
 * acknowledgement, and only the body carries 「ご希望に沿えない」.
 *
 * @returns {{kind: string, evidence: string, rule: string}}
 */
export function resolveKind({ kind, subject, body, hasInterviewDate = false }) {
  // An offer stands on its own; nothing below should be able to demote it.
  if (kind === 'offer') return { kind, evidence: '', rule: 'model' };

  const foldedSubject = fold(subject);
  const foldedAll = fold(`${subject || ''} ${body || ''}`);

  const rejection = firstMatch(REJECTION_PHRASES, foldedAll);
  if (rejection) return { kind: 'rejected', evidence: rejection, rule: 'rejection-phrase' };

  const invitation = firstMatch(INTERVIEW_INVITATION_PHRASES, foldedAll);
  const offer = firstMatch(OFFER_PHRASES, foldedAll);

  const decision = firstMatch(DECISION_NOTICE_SUBJECT, foldedSubject);
  if (decision && !invitation && !offer) {
    // A result announced with no invitation and no offer. Ｓｋｙ株式会社 posts the
    // verdict to a candidate portal and the mail only says 「マイページに記載して
    // おります」 — the mail is still, unambiguously, a decision, and it is not an
    // invitation to anything.
    return { kind: 'rejected', evidence: decision, rule: 'decision-notice' };
  }

  if (kind === 'interview' && !invitation && !hasInterviewDate) {
    return { kind: 'applied', evidence: '', rule: 'interview-unsupported' };
  }

  return { kind, evidence: '', rule: 'model' };
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
    `{"isApplicationRelated":bool,"isInternship":bool,"internshipEvidence":str,"kind":"applied|rejected|interview|offer|other","company":str,"role":str,` +
    `"interview":{"date":"YYYY-MM-DD","time":"HH:mm"|null}|null,"reapplyMonths":{"min":int,"max":int}|null,"confidence":0..1}\n` +
    `Rules: isApplicationRelated=true only for emails about the user's OWN application to a company — ` +
    `including applications made on the company's own site or a job board (the confirmation still lands here). ` +
    `Marketing, newsletters, generic job alerts, and security notices are false.\n` +
    `isInternship=true ONLY for an internship / co-op / new-grad program (インターン・インターンシップ・新卒採用). ` +
    `Freelance or gig work, crowdwork, LLM/data-annotation or "AI trainer" gigs, tutoring, part-time jobs, ` +
    `customer-support roles, and regular full-time positions are isInternship=false even when application-related.\n` +
    `internshipEvidence: when isInternship=true, quote the EXACT words from the email above (copy them ` +
    `character for character, max ~12 words) that show this is an internship — e.g. "Summer Internship 2026", ` +
    `"インターンシップ選考", "new grad program". The quote is verified against the email and a claim without ` +
    `one is discarded, so never paraphrase or invent it. Empty string when isInternship=false.\n` +
    `kind:\n` +
    `- "applied": application confirmation / registration / pre-entry / "thank you for applying" / エントリー・応募完了.\n` +
    `- "interview": ANY selection step past "applied" — an interview invite/schedule, OR a coding test / online / ` +
    `technical assessment (e.g. Codility, HackerRank, "invites you to a test") / screening / 選考・コーディングテスト・Webテスト. ` +
    `Extract a date/time into "interview" if one is present (a coding-test deadline counts).\n` +
    `- "rejected": a rejection. JAPANESE REJECTIONS ARE INDIRECT and never say "unfortunately" the way ` +
    `English ones do — they say the company cannot meet your wishes. ALL of these mean rejected: ` +
    `「貴意に添いかねる」「ご希望に沿えない」「ご期待に添えない」「今回は見送らせていただきます」「不合格」「お見送り」「ご縁がなかった」.\n` +
    `- "offer": an offer / 内定.\n` +
    `- "other": application-related but none of the above.\n` +
    `READ THE BODY, NOT JUST THE SUBJECT. A Japanese rejection is routinely sent under a polite ` +
    `acknowledgement subject — 「ご応募のお礼」 / 「ご応募ありがとうございます」 ("thank you for applying") ` +
    `— with the decision stated only in the body. Classify from whichever part carries the decision.\n` +
    `「選考結果」/「選考の結果」 in a SUBJECT means a decision has been made. That is NOT an interview ` +
    `invitation, and it is most often a rejection — even when the mail only points you at a portal ` +
    `(「選考結果はマイページに記載しております」). Only call it "interview" when the mail actually invites or ` +
    `schedules a further step (面接・面談・日程調整, or an explicit invitation).\n` +
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
    const modelKind = VALID_KINDS.has(parsed.kind) ? parsed.kind : 'other';
    let interview = parsed.interview && /^\d{4}-\d{2}-\d{2}$/.test(parsed.interview.date || '')
      ? { date: parsed.interview.date, time: /^\d{2}:\d{2}$/.test(parsed.interview.time || '') ? parsed.interview.time : null }
      : null;
    // The prompt above tells the model how Japanese rejections read; this is the
    // check that makes it falsifiable. Verified phrase evidence from the email
    // itself wins over the model's guess — see resolveKind.
    const body = message.text || message.snippet || '';
    const verdictKind = resolveKind({
      kind: modelKind, subject: message.subject, body, hasInterviewDate: Boolean(interview),
    });
    const kind = verdictKind.kind;
    // A demoted or rejected verdict must not leave an interview date behind: the
    // client turns one into a calendar milestone, and a rejection with a phantom
    // interview on the calendar is the HENNGE defect in another shape.
    if (kind !== 'interview') interview = null;
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
    // Ground the claim in the email's own words. The model proposes; the quote
    // check disposes — see internshipEvidenceHolds.
    const haystack = `${message.subject || ''} ${body}`;
    const proven = internshipEvidenceHolds(parsed.internshipEvidence, haystack);
    return {
      isApplicationRelated: Boolean(parsed.isApplicationRelated),
      isInternship: Boolean(parsed.isInternship) && proven,
      internshipEvidence: proven ? String(parsed.internshipEvidence).slice(0, 120) : '',
      kind,
      // Which rule decided `kind`, and the phrase that proved it. Server-side
      // only (never queued): the action shape is a client contract.
      kindRule: verdictKind.rule,
      kindEvidence: verdictKind.evidence,
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
