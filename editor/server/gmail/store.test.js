import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveConnection, setAiPaused, setRefreshToken } from './store.js';

// In-memory stand-in for the KV store (getJson/setJson are all store.js uses here).
const memoryStore = seed => {
  const kv = new Map(Object.entries(seed));
  return {
    kv,
    getJson: async (key, fallback) => (kv.has(key) ? structuredClone(kv.get(key)) : fallback),
    setJson: async (key, value) => { kv.set(key, structuredClone(value)); },
  };
};

test('a scan that finishes after Pause does not revert it', async () => {
  const store = memoryStore({ 'gmail:p': { refreshTokenEnc: 'x', settings: { autoApply: true } } });
  const stale = await store.getJson('gmail:p');              // scan starts
  await setAiPaused(store, 'p', true);                       // owner pauses mid-scan
  await saveConnection(store, 'p', { ...stale, lastSyncAt: 'now' }); // scan writes back
  assert.equal(store.kv.get('gmail:p').settings.aiPaused, true);
  assert.equal(store.kv.get('gmail:p').lastSyncAt, 'now');
});

test('reconnecting keeps the owner\'s pause', async () => {
  const store = memoryStore({ 'gmail:p': { refreshTokenEnc: 'x', settings: { autoApply: true, aiPaused: true } } });
  await setRefreshToken(store, 'p', { email: 'e', settings: { autoApply: true } }, null);
  assert.equal(store.kv.get('gmail:p').settings.aiPaused, true);
});
