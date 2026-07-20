const HIGH_RELEVANCE_SCORE = 98;
// 'rejected' counts as applied: you did apply, so the company should still be
// treated as one you've approached when ranking.
const APPLIED_TYPE_STATUSES = new Set(['applying', 'applied', 'interview', 'rejected']);
const PROFILE_APPLIED_COMPANIES = {
  mohamed_fuad: ['HENNGE', 'Rakuten Group'],
};

function normalizeCompanyName(value) {
  return String(value || '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function appliedCompaniesForProfile(profileId, records = []) {
  const companies = new Set();
  for (const name of PROFILE_APPLIED_COMPANIES[profileId] || []) {
    companies.add(normalizeCompanyName(name));
  }
  for (const record of records) {
    if (APPLIED_TYPE_STATUSES.has(record.status)) companies.add(normalizeCompanyName(record.company));
  }
  return companies;
}

export function appliedCompanyRank(item, appliedCompanies) {
  const alreadyApplied = appliedCompanies.has(normalizeCompanyName(item.company));
  return alreadyApplied && Number(item.score || 0) < HIGH_RELEVANCE_SCORE ? 1 : 0;
}

export function compareCompanyAwareMatch(a, b, appliedCompanies) {
  return appliedCompanyRank(a, appliedCompanies) - appliedCompanyRank(b, appliedCompanies)
    || Number(b.score || 0) - Number(a.score || 0);
}
