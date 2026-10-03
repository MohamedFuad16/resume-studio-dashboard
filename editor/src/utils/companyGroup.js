// Grouping key for the company page: "Mercari", "Mercari Group" and
// "株式会社メルカリ"'s roles and applications land on one page.
//
// Deliberately looser than normalizeCompany (reapplyCooldown.js), which is the
// tracker identity key the Gmail matching rules depend on and must not change.
// This one only decides what a company page shows.
import { normalizeCompany } from './reapplyCooldown.js';

const TRAILING = new Set(['group', 'holdings', 'holding', 'corporation', 'corp', 'company', 'co', 'japan', 'jp', 'kk', 'k.k', 'inc', 'ltd', 'llc', 'gk', 'グループ', 'ホールディングス', 'ジャパン']);

export function companyGroupKey(name) {
  const words = normalizeCompany(name).split(/\s+/).filter(Boolean);
  while (words.length > 1 && TRAILING.has(words[words.length - 1].replace(/\.$/, ''))) words.pop();
  return words.join(' ');
}

export const sameCompany = (a, b) => {
  const ka = companyGroupKey(a);
  return Boolean(ka) && ka === companyGroupKey(b);
};
