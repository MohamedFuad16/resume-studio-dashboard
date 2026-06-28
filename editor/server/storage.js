import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import initSqlJs from 'sql.js';

const require = createRequire(import.meta.url);
const SQL_WASM_DIR = path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm'));
const BLOB_DB_KEY = process.env.RESUME_STUDIO_DB_BLOB_KEY || 'resume-studio/resume-studio.sqlite';

export function createStore({ localDbPath }) {
  let SQL;
  let db;
  let ready;
  let backend = 'local-sqlite';

  const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const blobOptions = () => ({
    access: 'private',
    ...(process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}),
  });

  async function loadBlobBytes() {
    if (!hasBlob()) return null;
    const { get } = await import('@vercel/blob');
    const result = await get(BLOB_DB_KEY, blobOptions());
    if (!result || result.statusCode === 404 || !result.stream) return null;
    if (result.statusCode && result.statusCode !== 200) {
      throw new Error(`Could not read Blob SQLite store (${result.statusCode})`);
    }
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }

  async function loadLocalBytes() {
    try {
      return new Uint8Array(await fs.readFile(localDbPath));
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('Could not read local SQLite DB:', error.message);
      return null;
    }
  }

  async function persist() {
    const bytes = Buffer.from(db.export());
    if (hasBlob()) {
      const { put } = await import('@vercel/blob');
      await put(BLOB_DB_KEY, bytes, {
        ...blobOptions(),
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/vnd.sqlite3',
      });
      backend = 'vercel-blob-sqlite';
      return;
    }
    await fs.mkdir(path.dirname(localDbPath), { recursive: true });
    await fs.writeFile(localDbPath, bytes);
    backend = process.env.VERCEL ? 'ephemeral-local-sqlite' : 'local-sqlite';
  }

  async function init() {
    if (ready) return ready;
    ready = (async () => {
      SQL = await initSqlJs({ locateFile: file => path.join(SQL_WASM_DIR, file) });
      const bytes = await loadBlobBytes() || await loadLocalBytes();
      db = bytes ? new SQL.Database(bytes) : new SQL.Database();
      db.run(`
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      if (hasBlob()) backend = 'vercel-blob-sqlite';
      else if (process.env.VERCEL) backend = 'ephemeral-local-sqlite';
      await persist();
    })();
    return ready;
  }

  async function getJson(key, fallback = null) {
    await init();
    const result = db.exec('SELECT value FROM kv WHERE key = ? LIMIT 1', [key]);
    const value = result?.[0]?.values?.[0]?.[0];
    if (typeof value !== 'string') return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  async function setJson(key, value) {
    await init();
    db.run(
      'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [key, JSON.stringify(value), new Date().toISOString()],
    );
    await persist();
    return value;
  }

  async function deleteKey(key) {
    await init();
    db.run('DELETE FROM kv WHERE key = ?', [key]);
    await persist();
  }

  async function listJson(prefix) {
    await init();
    const result = db.exec('SELECT key, value FROM kv WHERE key LIKE ? ORDER BY updated_at DESC', [`${prefix}%`]);
    return (result?.[0]?.values || []).map(([key, value]) => {
      try {
        return { key, value: JSON.parse(value) };
      } catch {
        return { key, value: null };
      }
    }).filter(item => item.value !== null);
  }

  return {
    init,
    get backend() { return backend; },
    getJson,
    setJson,
    deleteKey,
    listJson,
  };
}
