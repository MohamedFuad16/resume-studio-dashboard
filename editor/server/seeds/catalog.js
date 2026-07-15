// Single source of truth for how the static seed datasets compose into the
// internship catalog. Imported by the Express server (`server/index.js`) and by
// the catalog validator (`server/validate-catalog.js`) so the two never drift.
//
// New date-stamped research files are appended here; the server merges these
// (dedup by id) on top of any stored live-research / custom entries.
import { internships as seedInternships } from './internships.js';
import { japanWideResearchInternships } from './japan-wide-research-2026-06-29.js';
import { japanWideResearch20260630 } from './japan-wide-research-2026-06-30.js';
import { enrichSeedInternships } from './internship-enrichment.js';
import { applyCatalogAudit20260702 } from './catalog-audit-2026-07-02.js';
import { applyAutoRefresh } from './auto-refresh.js';

export const seedInternshipCatalog = [
  ...seedInternships,
  ...japanWideResearchInternships,
  ...japanWideResearch20260630,
];

// The catalog exactly as the server materializes it from seeds (pre-validation,
// pre-merge with stored live entries): enrichment overrides applied.
export function buildSeedCatalog() {
  // Outermost overlay = the daily auto-refresh (retire dead listings + patch
  // changed deadlines); it must run last so it sees the fully-composed catalog.
  return applyAutoRefresh(applyCatalogAudit20260702(enrichSeedInternships(seedInternshipCatalog)));
}
