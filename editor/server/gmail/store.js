// Persistence for the Gmail integration, on top of the server KV store
// (storage.js → Azure Files in prod). Keyed by profile id. The refresh token is
// stored AES-256-GCM-encrypted and NEVER returned to the client.
//
//   gmail:{profile}        connection: encrypted refresh token + sync cursor + settings
//   gmail-queue:{profile}  pending actions the client drains into Firestore
//   gmail-oauth-state:{n}  short-lived CSRF state for the OAuth round-trip
import { encrypt, decrypt } from './crypto.js';

const connKey = profile => `gmail:${profile}`;
const queueKey = profile => `gmail-queue:${profile}`;
const stateKey = nonce => `gmail-oauth-state:${nonce}`;

// ── Connection ───────────────────────────────────────────────────────
export async function getConnection(store, profile) {
  return store.getJson(connKey(profile), null);
}

export async function saveConnection(store, profile, conn) {
  await store.setJson(connKey(profile), conn);
  return conn;
}

export async function setRefreshToken(store, profile, patch, refreshToken) {
  const existing = (await getConnection(store, profile)) || {};
  const conn = { ...existing, ...patch };
  if (refreshToken) conn.refreshTokenEnc = encrypt(refreshToken);
  await store.setJson(connKey(profile), conn);
  return conn;
}

export function readRefreshToken(conn) {
  if (!conn?.refreshTokenEnc) return null;
  try { return decrypt(conn.refreshTokenEnc); } catch { return null; }
}

export async function deleteConnection(store, profile) {
  await store.deleteKey(connKey(profile)).catch(() => {});
  await store.deleteKey(queueKey(profile)).catch(() => {});
}

// Client-safe view: no token material, ever.
export function publicStatus(conn) {
  if (!conn) return { connected: false };
  return {
    connected: Boolean(conn.refreshTokenEnc),
    email: conn.email || '',
    connectedAt: conn.connectedAt || null,
    lastSyncAt: conn.lastSyncAt || null,
    lastError: conn.lastError || null,
    autoApply: conn.settings?.autoApply !== false,
  };
}

// Every profile that has a connection — the cron loop iterates these.
export async function listConnectedProfiles(store) {
  const all = await store.listJson('gmail:').catch(() => ({}));
  const profiles = [];
  for (const [key, conn] of Object.entries(all || {})) {
    if (conn?.refreshTokenEnc) profiles.push(key.replace(/^gmail:/, ''));
  }
  return profiles;
}

// ── Pending-action queue (client drains → Firestore) ─────────────────
export async function getQueue(store, profile) {
  return store.getJson(queueKey(profile), []);
}

export async function pushQueue(store, profile, actions) {
  if (!actions.length) return;
  const existing = await getQueue(store, profile);
  const seen = new Set();
  for (const action of existing) {
    if (action.dedupeKey) seen.add(action.dedupeKey);
  }
  const fresh = actions.filter(a => !a.dedupeKey || !seen.has(a.dedupeKey));
  if (fresh.length) await store.setJson(queueKey(profile), [...existing, ...fresh]);
}

export async function ackQueue(store, profile, actionIds) {
  const ids = new Set(actionIds || []);
  const remaining = (await getQueue(store, profile)).filter(a => !ids.has(a.id));
  await store.setJson(queueKey(profile), remaining);
  return remaining.length;
}

// ── OAuth CSRF state (short-lived) ───────────────────────────────────
export async function saveOAuthState(store, nonce, data) {
  await store.setJson(stateKey(nonce), { ...data, createdAt: Date.now() });
}

export async function takeOAuthState(store, nonce) {
  const data = await store.getJson(stateKey(nonce), null);
  if (data) await store.deleteKey(stateKey(nonce)).catch(() => {});
  // 10-minute validity window.
  if (!data || Date.now() - (data.createdAt || 0) > 600000) return null;
  return data;
}
