import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import initSqlJs from 'sql.js';

const require = createRequire(import.meta.url);
const SQL_WASM_DIR = path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm'));
const BLOB_DB_KEY = process.env.RESUME_STUDIO_DB_BLOB_KEY || 'resume-studio/resume-studio.sqlite';
const BLOB_DB_PREFIX = BLOB_DB_KEY.replace(/\.sqlite$/i, '');
const BLOB_HISTORY_LIMIT = 8;

export function createStore({ localDbPath }) {
  let SQL;
  let db;
  let ready;
  let operations = Promise.resolve();
  let backend = 'local-sqlite';

  // Blob is a best-effort durability layer, never a hard dependency. If the store
  // is unreachable (quota pause, revoked/expired token, network), we log once and
  // fall back to the local SQLite file rather than failing the request — a Blob
  // outage used to 500 every /api/* route and hang the app on "Loading…".
  // See BUG-011 in agent/errors.md.
  let blobDisabled = false;
  const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN) && !blobDisabled;
  const disableBlob = (operation, error) => {
    if (!blobDisabled) {
      blobDisabled = true;
      console.warn(
        `Vercel Blob unavailable during ${operation} (${error.message}). ` +
        'Falling back to local SQLite for the rest of this process; ' +
        'data will not be shared across instances until Blob is restored.'
      );
    }
  };
  const tokenOptions = () => (
    process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}
  );
  const blobOptions = () => ({
    access: 'private',
    ...tokenOptions(),
  });

  async function loadBlobBytes() {
    if (!hasBlob()) return null;
    try {
      const { get, list } = await import('@vercel/blob');
      const listed = await list({
        prefix: BLOB_DB_PREFIX,
        limit: 100,
        ...tokenOptions(),
      });
      const latest = listed.blobs
        .filter(blob => blob.pathname === BLOB_DB_KEY || (blob.pathname.startsWith(`${BLOB_DB_PREFIX}-`) && blob.pathname.endsWith('.sqlite')))
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
      if (!latest) return null;
      const result = await get(latest.url, blobOptions());
      if (!result || result.statusCode === 404 || !result.stream) return null;
      if (result.statusCode && result.statusCode !== 200) {
        throw new Error(`Could not read Blob SQLite store (${result.statusCode})`);
      }
      return new Uint8Array(await new Response(result.stream).arrayBuffer());
    } catch (error) {
      // Read failure → serve from local instead of failing the request.
      disableBlob('read', error);
      return null;
    }
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
      try {
        const { del, list, put } = await import('@vercel/blob');
        const pathname = `${BLOB_DB_PREFIX}-${Date.now()}-${randomUUID()}.sqlite`;
        await put(pathname, bytes, {
          ...blobOptions(),
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60,
          contentType: 'application/vnd.sqlite3',
        });
        const listed = await list({
          prefix: BLOB_DB_PREFIX,
          limit: 100,
          ...tokenOptions(),
        });
        const stale = listed.blobs
          .filter(blob => blob.pathname === BLOB_DB_KEY || (blob.pathname.startsWith(`${BLOB_DB_PREFIX}-`) && blob.pathname.endsWith('.sqlite')))
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
          .slice(BLOB_HISTORY_LIMIT)
          .map(blob => blob.url);
        if (stale.length) await del(stale, tokenOptions());
        backend = 'vercel-blob-sqlite';
        return;
      } catch (error) {
        // Write failure → fall through to the local write below. Losing the
        // remote copy is recoverable; losing the write is not.
        disableBlob('write', error);
      }
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

  function serialize(operation) {
    const next = operations.then(operation, operation);
    operations = next.catch(() => {});
    return next;
  }

  async function refreshFromBlob() {
    if (!hasBlob()) return;
    const bytes = await loadBlobBytes();
    if (!bytes) return;
    const nextDb = new SQL.Database(bytes);
    db?.close();
    db = nextDb;
    backend = 'vercel-blob-sqlite';
  }

  async function getJson(key, fallback = null) {
    await init();
    return serialize(async () => {
      await refreshFromBlob();
      const result = db.exec('SELECT value FROM kv WHERE key = ? LIMIT 1', [key]);
      const value = result?.[0]?.values?.[0]?.[0];
      if (typeof value !== 'string') return fallback;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    });
  }

  async function setJson(key, value) {
    await init();
    return serialize(async () => {
      await refreshFromBlob();
      db.run(
        'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
        [key, JSON.stringify(value), new Date().toISOString()],
      );
      await persist();
      return value;
    });
  }

  async function deleteKey(key) {
    await init();
    return serialize(async () => {
      await refreshFromBlob();
      db.run('DELETE FROM kv WHERE key = ?', [key]);
      await persist();
    });
  }

  async function listJson(prefix) {
    await init();
    return serialize(async () => {
      await refreshFromBlob();
      const result = db.exec('SELECT key, value FROM kv WHERE key LIKE ? ORDER BY updated_at DESC', [`${prefix}%`]);
      return (result?.[0]?.values || []).map(([key, value]) => {
        try {
          return { key, value: JSON.parse(value) };
        } catch {
          return { key, value: null };
        }
      }).filter(item => item.value !== null);
    });
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
