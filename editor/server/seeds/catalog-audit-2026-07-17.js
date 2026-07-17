// Official-source re-audit performed on 2026-07-17 JST.
//
// Checked Mercari Group's official Workable board via its public jobs API
// (apply.workable.com/api/v3/accounts/mercari/jobs): all three Class-of-2028
// internship postings are PUBLISHED and accepting applications today —
// including the Software Engineer internship that the 2026-07-02 audit retired
// as "explicitly expired" (its posted 2026-06-30 deadline passed, but the
// posting remained live past it, i.e. the window was extended/reopened).
//
//   • Reinstates: mercari-software-engineer-2028 (deadline now unstated on the
//     posting — patched to "Not stated" so the radar doesn't show a past date).
//   • Re-verifies: mercari-security-engineer-2028, mercari-uiux-2028
//     (verifiedDate bumped; both still live on the same board).
//
// Wire-up: isRetiredInternshipId() in catalog-audit-2026-07-02.js subtracts
// reinstatedIds20260717, and buildSeedCatalog() applies these patches after
// the 07-02 audit (see seeds/catalog.js).

export const reinstatedIds20260717 = new Set([
  'mercari-software-engineer-2028',
]);

const patches20260717 = new Map([
  [
    'mercari-software-engineer-2028',
    {
      deadline: 'Not stated (posting live past the earlier 2026-06-30 date)',
      deadlineDate: null,
      deadlineType: 'Reopened / no fixed date stated',
      verifiedDate: '2026-07-17',
    },
  ],
  [
    'mercari-security-engineer-2028',
    { verifiedDate: '2026-07-17' },
  ],
  [
    'mercari-uiux-2028',
    { verifiedDate: '2026-07-17' },
  ],
]);

export function applyCatalogAudit20260717(items) {
  return items.map(item => ({ ...item, ...(patches20260717.get(item.id) || {}) }));
}
