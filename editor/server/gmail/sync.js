// Sync orchestrator: pull new mail since the stored cursor, classify each, and
// push normalized actions to the per-profile queue. The CLIENT drains the queue
// and applies actions to its Firestore tracker/calendar (it owns the match against
// existing records — the server can't read the user's client-direct Firestore).
import { getConnection, saveConnection, pushQueue } from './store.js';
import { getAccessToken, listNewMessageIds, listRecentMessageIds, getProfileHistoryId, getMessage, ReauthRequiredError } from './gmailClient.js';
import { classifyMessage, enrichCompany, llmAvailable } from './classify.js';
import { buildSeedCatalog } from '../seeds/catalog.js';

const MIN_CONFIDENCE = Number(process.env.GMAIL_MIN_CONFIDENCE || 0.6);
const MAX_MESSAGES_PER_SYNC = Number(process.env.GMAIL_MAX_MESSAGES_PER_SYNC || 25);
const PROCESSED_CAP = 500;
let counter = 0;

// Backfill uses a keyword search (EN + JA) so application mail surfaces regardless
// of newsletter volume — a plain recent-N scan buried the real signals under noise.
const APPLICATION_QUERY = [
  '"thank you for applying"', '"thank you for your application"', 'application', 'applied',
  'interview', '"coding test"', '"online assessment"', 'assessment', 'Codility', 'HackerRank',
  'screening', 'rejected', '"not selected"', '"selection result"', 'offer',
  'エントリー', '応募', '選考', '面接', 'コーディングテスト', 'Webテスト', 'インターン', '不合格', 'お見送り', '内定',
].join(' OR ');

// Keep CJK and strip corporate prefixes, mirroring the client: a purely-Japanese
// company name must not normalize to '' (empty enrich-map keys collide, and the
// known-company check can never match one).
const norm = s => String(s || '').replace(/株式会社|合同会社|有限会社|\(株\)|（株）/g, '')
  .toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/gu, '-').replace(/^-|-$/g, '');

// RFC 2822 (or anything Date can read) → ISO 8601, or null if unparseable.
const toISO = value => {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

// Companies we already know — the internship catalog (stored, else seeds) and the
// server-side tracker — never need a web search: the client resolves their
// details from its own records/catalog when it drains the queue.
async function knownCompanyNames(store, profile) {
  const names = [];
  const catalog = await store.getJson('internships:catalog', null).catch(() => null);
  for (const item of (Array.isArray(catalog) && catalog.length ? catalog : buildSeedCatalog())) names.push(norm(item?.company));
  const tracker = await store.getJson(`tracker:${profile}`, {}).catch(() => ({}));
  for (const rec of Object.values(tracker && typeof tracker === 'object' ? tracker : {})) names.push(norm(rec?.company));
  return names.filter(Boolean);
}

const isKnownCompany = (names, company) => {
  const needle = norm(company);
  return Boolean(needle) && names.some(n => n.includes(needle) || needle.includes(n));
};

export async function syncProfile(store, profile, opts = {}) {
  const conn = await getConnection(store, profile);
  if (!conn?.refreshTokenEnc) return { skipped: 'not-connected' };
  if (!llmAvailable()) return { skipped: 'no-llm-key' };

  let token;
  try {
    token = await getAccessToken(store, profile);
  } catch (error) {
    if (error instanceof ReauthRequiredError) return { skipped: 'reauth_required' };
    throw error;
  }

  // Which messages to scan. Normal sync = new mail since the cursor. Backfill =
  // a one-time wider scan of older mail (does NOT move the incremental cursor).
  let messageIds = [];
  let nextHistoryId = conn.historyId;
  const backfillDays = Number(opts.backfillDays || 0);
  if (backfillDays > 0) {
    messageIds = await listRecentMessageIds(token, `newer_than:${backfillDays}d -in:sent -in:draft (${APPLICATION_QUERY})`, 100);
  } else if (conn.historyId) {
    const res = await listNewMessageIds(token, conn.historyId);
    if (res.stale) {
      messageIds = await listRecentMessageIds(token);
      nextHistoryId = await getProfileHistoryId(token);
    } else {
      messageIds = res.messageIds || [];
      nextHistoryId = res.historyId;
    }
  } else {
    messageIds = await listRecentMessageIds(token);
    nextHistoryId = await getProfileHistoryId(token);
  }

  const cap = backfillDays > 0 ? 80 : MAX_MESSAGES_PER_SYNC;
  const processed = new Set(conn.processedMessageIds || []);
  // Backfill is a deliberate one-time rescan: ignore the processed list (the
  // queue dedupes by message:kind), so a scan that ran misconfigured can rerun.
  const fresh = (backfillDays > 0 ? messageIds : messageIds.filter(id => !processed.has(id))).slice(0, cap);

  const actions = [];
  // Why messages were dropped, as COUNTS ONLY — no subjects, no senders, no quotes.
  // A sync that returns "0 actions" is otherwise unfalsifiable: a correct filter
  // and a broken one look identical from outside, and the difference decides
  // whether the inbox is clean or the ingest is dead.
  const dropped = { fetchFailed: 0, classifierFailed: 0, notApplication: 0, notInternship: 0, lowConfidence: 0, noCompany: 0 };
  const enrichedByCompany = new Map();
  let knownNames = null; // loaded lazily on the first enrichment candidate
  for (const id of fresh) {
    let message;
    try { message = await getMessage(token, id); } catch { processed.add(id); dropped.fetchFailed++; continue; }
    const verdict = await classifyMessage(message);
    if (!verdict) { dropped.classifierFailed++; continue; } // leave unprocessed so a later sync retries
    processed.add(id);
    // Internships only: freelance/gig/annotation/part-time applications (e.g. an
    // LLM-trainer gig or an AI-interview support role) never reach the tracker.
    if (!verdict.isApplicationRelated) { dropped.notApplication++; continue; }
    if (!verdict.isInternship) { dropped.notInternship++; continue; }
    if (verdict.confidence < MIN_CONFIDENCE) { dropped.lowConfidence++; continue; }
    if (!verdict.company) { dropped.noCompany++; continue; }

    // Enrich once per company for application/offer emails, so the client can
    // create a record with a real posting URL/location/deadline if it's new.
    // Companies already in the catalog or tracker skip the search entirely.
    let enrichment = null;
    if ((verdict.kind === 'applied' || verdict.kind === 'offer')) {
      const key = norm(verdict.company);
      if (!enrichedByCompany.has(key)) {
        if (!knownNames) knownNames = await knownCompanyNames(store, profile);
        enrichedByCompany.set(key, isKnownCompany(knownNames, verdict.company) ? null : await enrichCompany(verdict.company, verdict.role));
      }
      enrichment = enrichedByCompany.get(key);
    }

    actions.push({
      id: `gmail-${Date.now()}-${counter++}`,
      dedupeKey: `${message.id}:${verdict.kind}`,
      gmailMessageId: message.id,
      threadId: message.threadId,
      // Normalise to ISO 8601. The email's Date header is RFC 2822
      // ("Fri, 03 Jul 2026 12:00:00 +0900"), which the iOS client's
      // ISO8601DateFormatter cannot parse — leaving every ingested record without
      // a usable applied/rejected date. new Date() reads RFC 2822 fine.
      receivedAt: toISO(message.date) || new Date().toISOString(),
      kind: verdict.kind,
      company: verdict.company,
      role: verdict.role,
      interview: verdict.interview,
      // Reapply cooldown extracted from a rejection ("apply again after N months").
      reapplyMonths: verdict.reapplyMonths || null,
      enrichment,
      confidence: verdict.confidence,
      subject: message.subject.slice(0, 200),
      source: 'gmail',
    });
  }

  await pushQueue(store, profile, actions);
  await saveConnection(store, profile, {
    ...conn,
    historyId: nextHistoryId || conn.historyId,
    lastSyncAt: new Date().toISOString(),
    lastError: null,
    processedMessageIds: [...processed].slice(-PROCESSED_CAP),
  });

  // A backfill outlives the request that starts it (the gateway gives up at 240s),
  // so its outcome can't be read from the HTTP response — only from here. Counts
  // only, never mail content: this is someone's inbox.
  console.log(
    `gmail-sync[${profile}] listed=${messageIds.length} fresh=${fresh.length} ` +
    `queued=${actions.length} dropped=${JSON.stringify(dropped)}`
  );

  return { scanned: fresh.length, actions: actions.length, dropped };
}
