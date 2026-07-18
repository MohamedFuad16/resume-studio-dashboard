// The shared KV store: a real SQLite database, run on LOCAL disk and snapshotted
// to the durable volume after every write.
//
// WHY THE TWO TIERS (this is the whole design, and the reason a previous attempt
// had to be rolled back):
//
// In production `localDbPath` points at an Azure Files (SMB) mount. SQLite needs
// POSIX advisory locks (fcntl) to coordinate access to its file, and SMB does not
// provide them — so opening the mounted file DIRECTLY makes every write fail with
// `SQLITE_BUSY: database is locked`, while reads keep working. That failure mode
// is invisible locally, because a local disk supports locking perfectly well.
//
// The engine this replaced (sql.js/WASM) survived the mount only by never using
// SQLite's locking at all: it held the database in memory and rewrote the ENTIRE
// file on each write, so the mount only ever saw a plain whole-file write.
//
// This keeps that property while getting a real engine: SQLite opens a working
// copy on the container's own disk (where locking works), and the mount only ever
// receives `copyFile` of the finished database — never a lock, never a partial
// page write. Durability is unchanged: every write is snapshotted before the call
// resolves, so a crash cannot lose anything that was reported as saved.
//
// Interface is unchanged: init / backend / getJson / setJson / deleteKey / listJson.
import Database from 'better-sqlite3';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export function createStore({ localDbPath }) {
  // The durable copy — the mounted volume in production.
  const durablePath = localDbPath;
  // The working copy — always a real local filesystem. Overridable so a test can
  // point it somewhere predictable.
  const workDir = process.env.RESUME_STUDIO_DB_WORKDIR
    || path.join(os.tmpdir(), 'resume-studio-db');
  const workPath = path.join(workDir, path.basename(durablePath));

  let db;
  let ready;
  let backend = 'sqlite-snapshot';
  // Writes and their snapshots run one at a time, so a copy can never observe a
  // half-applied write from the next one.
  let operations = Promise.resolve();

  function serialize(operation) {
    const next = operations.then(operation, operation);
    operations = next.catch(() => {});
    return next;
  }

  // Copy the working database over the durable one, atomically where possible.
  async function snapshot() {
    await fs.mkdir(path.dirname(durablePath), { recursive: true });
    const staging = `${durablePath}.staging`;
    await fs.copyFile(workPath, staging);
    try {
      // Rename is atomic on a POSIX filesystem, so a reader never sees a
      // half-written database.
      await fs.rename(staging, durablePath);
    } catch {
      // Some network filesystems refuse rename-over-existing. Fall back to the
      // direct overwrite the previous engine always did.
      await fs.copyFile(staging, durablePath);
      await fs.rm(staging, { force: true });
    }
  }

  async function init() {
    if (ready) return ready;
    ready = (async () => {
      await fs.mkdir(workDir, { recursive: true });

      // Seed the working copy from whatever is already durable. The file the old
      // sql.js engine wrote is a perfectly ordinary SQLite database, so this
      // migrates in place with no conversion step.
      try {
        await fs.copyFile(durablePath, workPath);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        // No durable database yet — make sure we don't inherit a stale working
        // copy left by an earlier process on this machine.
        await fs.rm(workPath, { force: true });
      }

      db = new Database(workPath);
      // NOT WAL: in WAL mode the .sqlite file alone is incomplete until a
      // checkpoint, and the snapshot copies exactly that one file. A rollback
      // journal leaves the database self-contained after every commit.
      db.pragma('journal_mode = DELETE');
      db.exec(`
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      backend = 'sqlite-snapshot';
      await snapshot();
    })();
    return ready;
  }

  async function getJson(key, fallback = null) {
    await init();
    const row = db.prepare('SELECT value FROM kv WHERE key = ? LIMIT 1').get(key);
    if (!row || typeof row.value !== 'string') return fallback;
    try {
      return JSON.parse(row.value);
    } catch {
      return fallback;
    }
  }

  async function setJson(key, value) {
    await init();
    return serialize(async () => {
      db.prepare(
        'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) '
        + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      ).run(key, JSON.stringify(value), new Date().toISOString());
      await snapshot();
      return value;
    });
  }

  async function deleteKey(key) {
    await init();
    return serialize(async () => {
      db.prepare('DELETE FROM kv WHERE key = ?').run(key);
      await snapshot();
    });
  }

  async function listJson(prefix) {
    await init();
    const rows = db
      .prepare('SELECT key, value FROM kv WHERE key LIKE ? ORDER BY updated_at DESC')
      .all(`${prefix}%`);
    return rows
      .map(({ key, value }) => {
        try {
          return { key, value: JSON.parse(value) };
        } catch {
          return { key, value: null };
        }
      })
      .filter(item => item.value !== null);
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
