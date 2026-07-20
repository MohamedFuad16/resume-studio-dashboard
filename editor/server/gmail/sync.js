// Sync orchestrator: pull new mail since the stored cursor, classify each, and
// push normalized actions to the per-profile queue. The CLIENT drains the queue
// and applies actions to its Firestore tracker/calendar (it owns the match against
// existing records — the server can't read the user's client-direct Firestore).
import { getConnection, saveConnection, pushQueue } from './store.js';
import { getAccessToken, listNewMessageIds, listRecentMessageIds, getProfileHistoryId, getMessage, ReauthRequiredError } from './gmailClient.js';
import { classifyMessage, enrichCompany, llmAvailable, hasBulkHeaders, bulkAdmission, senderDisplayName } from './classify.js';
import { buildSeedCatalog } from '../seeds/catalog.js';

const MIN_CONFIDENCE = Number(process.env.GMAIL_MIN_CONFIDENCE || 0.6);
const MAX_MESSAGES_PER_SYNC = Number(process.env.GMAIL_MAX_MESSAGES_PER_SYNC || 25);
const PROCESSED_CAP = 500;
// Same shape and the same reason as PROCESSED_CAP: the connection record is a
// KV blob and must not grow without bound. Insertion-ordered, so slice(-CAP)
// keeps the most recently seen companies.
const INTERNSHIP_COMPANY_CAP = 500;
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

// Companies whose posting details the client can ALREADY resolve without a web
// search — so enriching them would waste a call:
//   • every internship-catalog listing (has url/location/deadline by construction);
//   • tracker records that already carry a real `applyUrl`.
// A tracker record that exists but is still sparse (a bare Gmail-created row like
// LAPRAS: name + role, no url) is deliberately NOT counted — the owner wants
// enrichment to FILL those in, not skip them (contracts/CHANGELOG 2026-07-19).
async function resolvableCompanyNames(store, profile) {
  const names = [];
  const catalog = await store.getJson('internships:catalog', null).catch(() => null);
  for (const item of (Array.isArray(catalog) && catalog.length ? catalog : buildSeedCatalog())) names.push(norm(item?.company));
  const tracker = await store.getJson(`tracker:${profile}`, {}).catch(() => ({}));
  for (const rec of Object.values(tracker && typeof tracker === 'object' ? tracker : {})) {
    // Only "resolvable" once the record has a posting URL — otherwise it's sparse
    // and should be enriched, not treated as already-known.
    if (rec?.applyUrl) names.push(norm(rec.company));
  }
  return names.filter(Boolean);
}

const isResolvableCompany = (names, company) => {
  const needle = norm(company);
  return Boolean(needle) && names.some(n => n.includes(needle) || needle.includes(n));
};

// A DECISION about an application we have already seen. See the gate below.
export const DECISION_KINDS = new Set(['rejected', 'interview', 'offer']);

// The canonical company key used by the two gates below. Exported so the tests
// can assert on the same function the sync uses.
export const companyKey = norm;

// Does queueing this verdict PROVE, on the mail's own words, that the owner
// applied to an internship at this company? Only a proven-internship
// application or offer counts: `isInternship` has already survived the quote
// check in classify.js, so this can never be self-fulfilling — a decision
// admitted by the gate below has isInternship=false and adds nothing.
export function provesInternshipApplication(verdict) {
  return Boolean(verdict?.isInternship && verdict?.company)
    && (verdict.kind === 'applied' || verdict.kind === 'offer');
}

// The gate. A decision (rejected/interview/offer) about a company for which
// THIS profile has previously emitted an internship application is admitted
// even though the decision mail itself carries no internship evidence.
//
// `internshipCompanies` is a Set of canonical company keys the SERVER has
// itself queued an internship `applied`/`offer` for — never a read of the
// owner's tracker. The tracker is client-direct Firestore (`users/{uid}/
// trackers/{profileId}`) and the server deliberately holds no user data
// (CLAUDE.md rule 4, contracts/README.md "the one data rule"); the old
// `tracker:{profile}` KV read was of a store that is essentially always empty,
// which is why carriedInternship was 0 on every run.
//
// Matched on EXACT normalized company equality, never a substring test
// (SPEC-per-role-keying §4).
export function admitsCarriedDecision(verdict, internshipCompanies) {
  if (!DECISION_KINDS.has(verdict?.kind) || !verdict?.company) return false;
  const key = companyKey(verdict.company);
  return Boolean(key) && internshipCompanies.has(key);
}

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
  // Gmail lists newest-first, and the cap must keep the most RECENT messages —
  // but the carry-forward below needs the application confirmation to be seen
  // BEFORE the decision it admits. So cap first, then reverse: oldest-first
  // processing, same window of mail. (Queue order is irrelevant to the client,
  // which sorts by receivedAt before applying — normalization.md §4.)
  const fresh = (backfillDays > 0 ? messageIds : messageIds.filter(id => !processed.has(id)))
    .slice(0, cap)
    .reverse();

  const actions = [];
  // Why messages were dropped, as COUNTS ONLY — no subjects, no senders, no quotes.
  // A sync that returns "0 actions" is otherwise unfalsifiable: a correct filter
  // and a broken one look identical from outside, and the difference decides
  // whether the inbox is clean or the ingest is dead.
  const dropped = { fetchFailed: 0, bulkSkipped: 0, classifierFailed: 0, notApplication: 0, notInternship: 0, lowConfidence: 0, noCompany: 0 };
  // Bulk-headered mail that was let through anyway because it is addressed to the
  // owner. Counted, not silent: the first version of this guard skipped 27 of 80
  // messages and took Sky's rejection and two real applications with it, and the
  // only reason that was ever noticed is that the owner said so out loud.
  let bulkAdmitted = 0;
  // Decisions admitted on a prior tracked application rather than on their own
  // internship evidence (see the gate below). Not a drop — counted separately so
  // the telemetry still balances: listed → fresh → queued + dropped.
  let carriedInternship = 0;
  const enrichedByCompany = new Map();
  let resolvableNames = null; // loaded lazily on the first enrichment candidate
  // Every company this profile has EVER had an internship application queued
  // for, seeded from the connection record so it survives restarts, and added
  // to as this run goes so an application can admit a decision processed later
  // in the SAME run (the fresh-backfill case: both mails arrive together).
  const internshipCompanies = new Set(
    (Array.isArray(conn.internshipCompanies) ? conn.internshipCompanies : []).filter(Boolean),
  );
  for (const id of fresh) {
    let message;
    try { message = await getMessage(token, id); } catch { processed.add(id); dropped.fetchFailed++; continue; }
    // Bulk headers are evidence, not a verdict. Japanese ATSs deliver
    // personally-addressed decision mail through bulk services — Sky via
    // mail.axol.jp, AICE via HERP — so a hard skip on List-Unsubscribe throws away
    // real rejections along with the newsletters. A bulk message is let through
    // when it is written TO the owner (a salutation, a first-party application
    // phrase, or a company already known to hold one of their applications), and
    // skipped otherwise. That is what separates Sky's rejection from a Reddit
    // digest quoting a stranger — the addressee, never the envelope.
    if (hasBulkHeaders(message)) {
      const why = bulkAdmission(message, {
        knownCompanies: internshipCompanies,
        senderKey: companyKey(senderDisplayName(message.from)),
      });
      if (!why) {
        // Marked processed: this verdict is a property of the headers and the
        // prose, and will not change on a retry.
        processed.add(id);
        dropped.bulkSkipped++;
        continue;
      }
      bulkAdmitted++;
    }
    const verdict = await classifyMessage(message);
    if (!verdict) { dropped.classifierFailed++; continue; } // leave unprocessed so a later sync retries
    processed.add(id);
    // Internships only: freelance/gig/annotation/part-time applications (e.g. an
    // LLM-trainer gig or an AI-interview support role) never reach the tracker.
    if (!verdict.isApplicationRelated) { dropped.notApplication++; continue; }
    // Internships only — the evidence gate (classify.js) requires a quoted
    // internship term from the mail itself, and it stays exactly as strict.
    //
    // But a DECISION mail frequently contains no internship word anywhere. The
    // owner's ABEJA rejection is 「厳正なる選考の結果、誠に残念ながら今回は貴意に
    // 添いかねることとなりました」 and its AICE counterpart is the same shape:
    // correct, complete rejections of real internship applications that name no
    // program, no role and no 「インターン」. Both were dropped here as
    // notInternship and the tracker sat frozen at "applied" — the application
    // confirmation had been ingested, its outcome never was.
    //
    // Their internship-ness was already PROVEN, by the confirmation mail this
    // very server queued (「＜新卒通年インターン＞…応募が完了しました」). So a
    // decision about a company this profile has already applied to as an
    // internship is admitted on that earlier evidence — remembered server-side
    // (see admitsCarriedDecision), not read out of the owner's Firestore.
    //
    // This does not loosen the gate: a company never seen applying to an
    // internship is not in the set, so a gig rejection is dropped exactly as
    // before.
    if (!verdict.isInternship) {
      if (!admitsCarriedDecision(verdict, internshipCompanies)) { dropped.notInternship++; continue; }
      carriedInternship++;
    }
    if (verdict.confidence < MIN_CONFIDENCE) { dropped.lowConfidence++; continue; }
    if (!verdict.company) { dropped.noCompany++; continue; }

    // Enrich once per company for application/offer emails so the client can fill
    // in a real posting URL/location/deadline. We skip the search only when the
    // details are ALREADY resolvable (catalog listing, or a tracker record that
    // already has a URL); a known-but-sparse record still gets enriched so its
    // missing details get filled — not left as bare name+role.
    let enrichment = null;
    if ((verdict.kind === 'applied' || verdict.kind === 'offer')) {
      const key = norm(verdict.company);
      if (!enrichedByCompany.has(key)) {
        if (!resolvableNames) resolvableNames = await resolvableCompanyNames(store, profile);
        enrichedByCompany.set(key, isResolvableCompany(resolvableNames, verdict.company) ? null : await enrichCompany(verdict.company, verdict.role));
      }
      enrichment = enrichedByCompany.get(key);
    }

    // Remember, for this profile, that this company is one the owner applied to
    // as an internship — the only thing that ever opens the gate above. Recorded
    // here, next to the push, so what the server REMEMBERS is exactly what it
    // QUEUED. Re-adding moves the key to the end of the insertion order, so the
    // cap below evicts the least recently seen company first.
    if (provesInternshipApplication(verdict)) {
      const key = companyKey(verdict.company);
      if (key) { internshipCompanies.delete(key); internshipCompanies.add(key); }
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
    internshipCompanies: [...internshipCompanies].slice(-INTERNSHIP_COMPANY_CAP),
  });

  // A backfill outlives the request that starts it (the gateway gives up at 240s),
  // so its outcome can't be read from the HTTP response — only from here. Counts
  // only, never mail content: this is someone's inbox.
  console.log(
    `gmail-sync[${profile}] listed=${messageIds.length} fresh=${fresh.length} ` +
    `queued=${actions.length} carriedInternship=${carriedInternship} ` +
    `bulkAdmitted=${bulkAdmitted} dropped=${JSON.stringify(dropped)}`
  );

  return { scanned: fresh.length, actions: actions.length, carriedInternship, bulkAdmitted, dropped };
}
