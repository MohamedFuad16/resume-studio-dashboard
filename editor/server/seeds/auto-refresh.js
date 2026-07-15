// Machine-owned catalog overlay — the ONLY catalog file the daily refresh job
// (server/refresh-catalog.js) writes to. State lives in the sibling JSON so the
// job can merge + re-emit it wholesale without ever parsing hand-formatted JS
// arrays. Two overlays:
//   • retired:        listings verified dead (HTTP-broken + LLM-confirmed) — filtered
//                     out of every catalog path via isRetiredInternshipId().
//   • deadlinePatches: id -> { deadline, deadlineDate, verifiedDate, note } applied
//                     on top of the seed entry when the posting's date changed.
// Provenance for each change is kept in the JSON (retiredAt/reason/evidenceUrl),
// so nothing is lost — the entry just stops appearing in the live catalog.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUTO_REFRESH_PATH = path.join(__dirname, 'auto-refresh.json');

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(AUTO_REFRESH_PATH, 'utf8'));
    return {
      updatedAt: data.updatedAt || null,
      retired: Array.isArray(data.retired) ? data.retired : [],
      deadlinePatches: data.deadlinePatches && typeof data.deadlinePatches === 'object' ? data.deadlinePatches : {},
    };
  } catch {
    return { updatedAt: null, retired: [], deadlinePatches: {} };
  }
}

export const autoRefreshData = load();
export const autoRetiredIds = new Set(autoRefreshData.retired.map(entry => entry.id).filter(Boolean));
export const autoDeadlinePatches = new Map(Object.entries(autoRefreshData.deadlinePatches));

export function isAutoRetiredId(id) {
  return autoRetiredIds.has(id);
}

// Outermost catalog overlay: drop auto-retired listings, then apply any deadline
// patch onto the surviving entries. Filtering is defensive — isRetiredInternshipId()
// already excludes these upstream — but keeps this function correct in isolation.
export function applyAutoRefresh(items) {
  return items
    .filter(item => !autoRetiredIds.has(item?.id))
    .map(item => {
      const patch = autoDeadlinePatches.get(item?.id);
      return patch ? { ...item, ...patch } : item;
    });
}
