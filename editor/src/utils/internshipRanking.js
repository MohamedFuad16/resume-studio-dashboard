const HIGH_RELEVANCE_SCORE = 98;
const APPLIED_TYPE_STATUSES = new Set(['applying', 'applied', 'interview']);
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
  return new Set([
    ...(PROFILE_APPLIED_COMPANIES[profileId] || []).map(normalizeCompanyName),
    ...records
      .filter(record => APPLIED_TYPE_STATUSES.has(record.status))
      .map(record => normalizeCompanyName(record.company)),
  ]);
}

export function appliedCompanyRank(item, appliedCompanies) {
  const alreadyApplied = appliedCompanies.has(normalizeCompanyName(item.company));
  return alreadyApplied && Number(item.score || 0) < HIGH_RELEVANCE_SCORE ? 1 : 0;
}

export function compareCompanyAwareMatch(a, b, appliedCompanies) {
  return appliedCompanyRank(a, appliedCompanies) - appliedCompanyRank(b, appliedCompanies)
    || Number(b.score || 0) - Number(a.score || 0);
}
