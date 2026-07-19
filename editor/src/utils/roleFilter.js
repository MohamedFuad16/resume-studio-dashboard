/**
 * Internship-only detection. The app tracks internship applications, so records
 * that aren't internships (freelance/gig/crowdwork mis-ingested from Gmail, e.g.
 * "AI Data Reviewer", "Language Expert") should not surface as applications.
 *
 * This is an INCLUSIVE filter — it decides what IS an internship rather than
 * blocklisting specific companies/roles (no hard-coded company names):
 *
 *   • A record linked to a catalog listing (or added in-app via the radar) is
 *     an internship by construction — its id is the real catalog id, not a
 *     `gmail-<slug>` synthetic minted for a company that isn't in the catalog.
 *   • A Gmail-only record (company not in the catalog) counts only when its
 *     role/company text positively says internship / co-op / new-grad, in EN
 *     or JA. Anything that doesn't identify as an internship is left out.
 *
 * Data only — no JSX, no React.
 */

// Universal internship markers (EN + JA) — the concept, not any company.
const INTERNSHIP_MARKERS =
  /\b(intern|internship|co-?op|trainee|new[\s-]?grad(uate)?|graduate\s+(program|scheme|trainee))\b|インターン(シップ)?|新卒|就業体験/i;

// Gmail records for a company NOT in the catalog are keyed `gmail-<slug>`;
// catalog/radar records keep the real catalog id (e.g. `hennge-…`, `global-091`,
// `live-…`). So a non-`gmail-` id means "a known catalog internship".
const isGmailSyntheticId = id => /^gmail-/.test(String(id || ''));

/** True when this tracker record is an internship application (should be shown). */
export function isInternshipApplication(record) {
  if (!record) return false;
  if (!isGmailSyntheticId(record.internshipId || record.id)) return true;
  return INTERNSHIP_MARKERS.test(`${record.role || ''} ${record.company || ''}`);
}

