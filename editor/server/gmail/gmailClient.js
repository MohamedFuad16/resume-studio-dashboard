// Gmail REST client (raw fetch, no googleapis dep). Handles access-token refresh
// from the stored encrypted refresh token, incremental history reads, and message
// fetch + text extraction. All calls are read-only (gmail.readonly scope).
import { refreshAccessToken } from './oauth.js';
import { getConnection, readRefreshToken, saveConnection } from './store.js';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// In-memory access-token cache (persists on the long-lived Azure container; a
// cold serverless start just refreshes again — cheap).
const tokenCache = new Map(); // profile -> { token, expiresAt }

export class ReauthRequiredError extends Error {
  constructor(message) { super(message); this.code = 'reauth_required'; }
}

// Valid access token for a profile, refreshing (and caching) as needed. Throws
// ReauthRequiredError when Google rejects the refresh token (revoked/expired).
export async function getAccessToken(store, profile) {
  const cached = tokenCache.get(profile);
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;

  const conn = await getConnection(store, profile);
  const refreshToken = readRefreshToken(conn);
  if (!refreshToken) throw new ReauthRequiredError('No Gmail refresh token stored');

  let tokens;
  try {
    tokens = await refreshAccessToken(refreshToken);
  } catch (error) {
    if (['invalid_grant', 'unauthorized_client'].includes(error.googleError)) {
      await saveConnection(store, profile, { ...conn, lastError: 'reauth_required' });
      throw new ReauthRequiredError('Gmail access was revoked or expired');
    }
    throw error;
  }
  const token = tokens.access_token;
  tokenCache.set(profile, { token, expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000 });
  return token;
}

async function gmailGet(accessToken, pathAndQuery) {
  const res = await fetch(`${GMAIL_BASE}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(`Gmail API ${res.status}: ${body.error?.message || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Current mailbox historyId — the baseline we advance from each sync.
export async function getProfileHistoryId(accessToken) {
  const profile = await gmailGet(accessToken, '/profile');
  return profile.historyId || null;
}

// New message ids since startHistoryId. Returns { messageIds, historyId }.
// A 404 means the cursor is too old (Gmail prunes history) — the caller falls
// back to a recent-message scan.
export async function listNewMessageIds(accessToken, startHistoryId) {
  const ids = new Set();
  let pageToken = '';
  let latestHistoryId = startHistoryId;
  do {
    const q = new URLSearchParams({ startHistoryId: String(startHistoryId), historyTypes: 'messageAdded' });
    if (pageToken) q.set('pageToken', pageToken);
    let page;
    try {
      page = await gmailGet(accessToken, `/history?${q.toString()}`);
    } catch (error) {
      if (error.status === 404) return { messageIds: null, historyId: startHistoryId, stale: true };
      throw error;
    }
    for (const h of page.history || []) {
      for (const added of h.messagesAdded || []) {
        if (added.message?.id) ids.add(added.message.id);
      }
    }
    if (page.historyId) latestHistoryId = page.historyId;
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return { messageIds: [...ids], historyId: latestHistoryId };
}

// Recent inbox messages by query — used as the stale-history fallback and for a
// one-time backfill scan of older mail.
export async function listRecentMessageIds(accessToken, query = 'newer_than:2d -in:sent -in:draft', maxResults = 25) {
  const q = new URLSearchParams({ q: query, maxResults: String(Math.min(maxResults, 100)) });
  const page = await gmailGet(accessToken, `/messages?${q.toString()}`);
  return (page.messages || []).map(m => m.id);
}

function decodeBody(data) {
  try { return Buffer.from(String(data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
  catch { return ''; }
}

// Walk the MIME tree for the best text: prefer text/plain, else strip text/html.
function extractText(payload) {
  if (!payload) return '';
  const stack = [payload];
  let plain = '';
  let html = '';
  while (stack.length) {
    const part = stack.shift();
    const mime = part.mimeType || '';
    const data = part.body?.data;
    if (mime === 'text/plain' && data) plain += decodeBody(data) + '\n';
    else if (mime === 'text/html' && data) html += decodeBody(data) + '\n';
    if (part.parts) stack.push(...part.parts);
  }
  const text = plain || html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
  return text.replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

// Fetch one message and return { id, from, subject, date, snippet, text, bulk }.
//
// `bulk` carries the RFC 2369 / RFC 3834 mailing-list headers, and nothing else
// from the header block. They are what separates mail SENT TO the user from mail
// BROADCAST to a list, which is the only thing that distinguishes a real
// application email from a digest that happens to talk about applications
// (see isBulkMail in classify.js). Deliberately a narrow named subset rather than
// the whole header map: nothing downstream should be able to read the inbox's
// headers wholesale.
export async function getMessage(accessToken, id) {
  const msg = await gmailGet(accessToken, `/messages/${id}?format=full`);
  const headers = Object.fromEntries((msg.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: headers.from || '',
    subject: headers.subject || '',
    date: headers.date || '',
    snippet: msg.snippet || '',
    text: extractText(msg.payload).slice(0, 6000),
    bulk: {
      listUnsubscribe: headers['list-unsubscribe'] || '',
      listId: headers['list-id'] || '',
      listPost: headers['list-post'] || '',
      precedence: headers.precedence || '',
    },
  };
}

