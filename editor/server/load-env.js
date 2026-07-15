// Local-only env loader (NOT committed upstream — recreated to unblock local dev).
// server/index.js does `import './load-env.js'` for its side effect: populate
// process.env from editor/.env.local (and editor/.env) before the app reads config.
// Existing process.env values win, so shell-provided vars are never overwritten.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorRoot = path.resolve(__dirname, '..');

function parseAndApply(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return; // file absent — nothing to load
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || key in process.env) continue; // don't clobber existing env
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// .env.local takes precedence over .env (loaded first; existing keys are kept).
parseAndApply(path.join(editorRoot, '.env.local'));
parseAndApply(path.join(editorRoot, '.env'));
