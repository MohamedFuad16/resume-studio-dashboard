import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// A tiny key → JSON KV store on a single SQLite file.
//
// In production the file lives on the Azure Files volume mounted at
// RESUME_STUDIO_DATA_DIR (ADR-0032); in dev it's `editor/server/.data`. We use the
// NATIVE better-sqlite3 engine writing straight to that file — no WASM, no
// serialize-the-whole-DB-on-every-write, and no Vercel Blob layer. That is safe
// because the Vercel serverless function was removed (plan W1): the server now runs
// ONLY on the always-on single-replica container and locally, where a native module
// and a real mounted disk both exist. See ADR-0040.
//
// The file format is standard SQLite3, so the existing sql.js-written
// `resume-studio.sqlite` opens as-is — the `kv` table is already present and its
// rows (catalog, Gmail queues, and any KV-path user data) carry over untouched.
// The KV interface (init / backend / getJson / setJson / deleteKey / listJson) is
// unchanged, so no caller or contract is affected.
export function createStore({ localDbPath }) {
  let db = null;
  let stmts = null;
  let backend = 'sqlite';

  function init() {
    if (db) return;
    fs.mkdirSync(path.dirname(localDbPath), { recursive: true });
    db = new Database(localDbPath);
    // Azure Files is an SMB network share, where SQLite's WAL mode (it needs
    // shared memory) is unsafe — so keep the default rollback journal. A single
    // replica (min = max = 1, ADR-0019) means exactly one writer, and
    // better-sqlite3 is synchronous, so there is no cross-process or in-process
    // interleaving to guard against (the old sql.js serialize-queue is gone).
    db.pragma('busy_timeout = 5000');
    db.exec(
      'CREATE TABLE IF NOT EXISTS kv (' +
      '  key TEXT PRIMARY KEY,' +
      '  value TEXT NOT NULL,' +
      '  updated_at TEXT NOT NULL' +
      ');'
    );
    stmts = {
      get: db.prepare('SELECT value FROM kv WHERE key = ? LIMIT 1'),
      upsert: db.prepare(
        'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
      ),
      del: db.prepare('DELETE FROM kv WHERE key = ?'),
      list: db.prepare('SELECT key, value FROM kv WHERE key LIKE ? ORDER BY updated_at DESC'),
    };
    // 'sqlite-mounted' when a data dir is configured (prod: the Azure Files mount);
    // 'sqlite-local' for a plain local disk in dev. describePersistence() proves
    // real durability from the filesystem — this label is only for the boot log.
    backend = process.env.RESUME_STUDIO_DATA_DIR ? 'sqlite-mounted' : 'sqlite-local';
  }

  // The interface stays async (callers `await` these); the work underneath is
  // synchronous better-sqlite3, so each call completes atomically with no await
  // point mid-operation.
  async function getJson(key, fallback = null) {
    init();
    const row = stmts.get.get(key);
    if (!row || typeof row.value !== 'string') return fallback;
    try {
      return JSON.parse(row.value);
    } catch {
      return fallback;
    }
  }

  async function setJson(key, value) {
    init();
    stmts.upsert.run(key, JSON.stringify(value), new Date().toISOString());
    return value;
  }

  async function deleteKey(key) {
    init();
    stmts.del.run(key);
  }

  async function listJson(prefix) {
    init();
    return stmts.list.all(`${prefix}%`).map(({ key, value }) => {
      try {
        return { key, value: JSON.parse(value) };
      } catch {
        return { key, value: null };
      }
    }).filter(item => item.value !== null);
  }

  function close() {
    if (db) { db.close(); db = null; stmts = null; }
  }

  return {
    init,
    close,
    get backend() { return backend; },
    getJson,
    setJson,
    deleteKey,
    listJson,
  };
}
