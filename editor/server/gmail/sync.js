// Sync orchestrator: pull new mail since the stored cursor, classify each, and
// push normalized actions to the per-profile queue. The CLIENT drains the queue
// and applies actions to its Firestore tracker/calendar (it owns the match against
// existing records — the server can't read the user's client-direct Firestore).
import { getConnection, saveConnection, pushQueue } from './store.js';
import { getAccessToken, listNewMessageIds, listRecentMessageIds, getProfileHistoryId, getMessage, ReauthRequiredError } from './gmailClient.js';
import { classifyMessage, enrichCompany } from './classify.js';

const MIN_CONFIDENCE = Number(process.env.GMAIL_MIN_CONFIDENCE || 0.6);
const MAX_MESSAGES_PER_SYNC = Number(process.env.GMAIL_MAX_MESSAGES_PER_SYNC || 25);
const PROCESSED_CAP = 500;
let counter = 0;

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function syncProfile(store, profile) {
  const conn = await getConnection(store, profile);
  if (!conn?.refreshTokenEnc) return { skipped: 'not-connected' };

  let token;
  try {
    token = await getAccessToken(store, profile);
  } catch (error) {
    if (error instanceof ReauthRequiredError) return { skipped: 'reauth_required' };
    throw error;
  }

  // Which messages are new since the stored cursor.
  let messageIds = [];
  let nextHistoryId = conn.historyId;
  if (conn.historyId) {
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

  const processed = new Set(conn.processedMessageIds || []);
  const fresh = messageIds.filter(id => !processed.has(id)).slice(0, MAX_MESSAGES_PER_SYNC);

  const actions = [];
  const enrichedByCompany = new Map();
  for (const id of fresh) {
    let message;
    try { message = await getMessage(token, id); } catch { processed.add(id); continue; }
    const verdict = await classifyMessage(message);
    processed.add(id);
    if (!verdict?.isApplicationRelated || verdict.confidence < MIN_CONFIDENCE || !verdict.company) continue;

    // Enrich once per company for application/offer emails, so the client can
    // create a record with a real posting URL/location/deadline if it's new.
    let enrichment = null;
    if ((verdict.kind === 'applied' || verdict.kind === 'offer')) {
      const key = norm(verdict.company);
      if (!enrichedByCompany.has(key)) enrichedByCompany.set(key, await enrichCompany(verdict.company, verdict.role));
      enrichment = enrichedByCompany.get(key);
    }

    actions.push({
      id: `gmail-${Date.now()}-${counter++}`,
      dedupeKey: `${message.id}:${verdict.kind}`,
      gmailMessageId: message.id,
      threadId: message.threadId,
      receivedAt: message.date || new Date().toISOString(),
      kind: verdict.kind,
      company: verdict.company,
      role: verdict.role,
      interview: verdict.interview,
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

  return { scanned: fresh.length, actions: actions.length };
}
