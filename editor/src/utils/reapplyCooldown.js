/**
 * Reapplication cooldown — when a company rejects an application and states a
 * wait period before reapplying (e.g. HENNGE's "please apply again after 9–12
 * months"), we stamp `reapplyAfter` on the tracker record. The cooldown is
 * COMPANY-WIDE: every role at that company is blocked from applying until the
 * date passes, because the policy is set by the company, not the posting.
 *
 * A record carries:
 *   reapplyAfter : 'YYYY-MM-DD'  — earliest date the user may reapply
 *   reapplyNote  : string        — human phrasing from the email
 *   reapplyMonths: { min, max }  — the stated window, for display
 *
 * Data only — no JSX, no React.
 */

// Same CJK-preserving normalizer the tracker/drain use, so "株式会社HENNGE",
// "HENNGE", and "hennge" all collapse to one company key.
const CORP = /株式会社|合同会社|有限会社|\(株\)|（株）/g;
export const normalizeCompany = value =>
  String(value || '').replace(CORP, '').toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/gu, ' ').trim();

/** Add `months` calendar months to an ISO date/instant → 'YYYY-MM-DD' (or null). */
export function addMonths(instant, months) {
  const date = instant instanceof Date ? new Date(instant) : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDate();
  date.setMonth(date.getMonth() + Number(months || 0));
  // Guard month-end overflow (e.g. Aug 31 + 6 → Feb): clamp back to last day.
  if (date.getDate() < day) date.setDate(0);
  return date.toISOString().slice(0, 10);
}

/** True when this record is a rejection whose stated reapply date is still ahead. */
export function isCooldownActive(record, now = new Date()) {
  if (!record || record.status !== 'rejected' || !record.reapplyAfter) return false;
  const until = new Date(`${record.reapplyAfter}T23:59:59+09:00`);
  return !Number.isNaN(until.getTime()) && until.getTime() > now.getTime();
}

/**
 * Company → active cooldown, derived from all tracker records. When a company
 * has several rejected records with dates, the LATEST reapplyAfter wins (the
 * most recent rejection resets the clock).
 * @returns {Map<string, {reapplyAfter, reapplyNote, reapplyMonths, company}>}
 */
export function companyCooldownMap(records, now = new Date()) {
  const map = new Map();
  for (const record of records || []) {
    if (!isCooldownActive(record, now)) continue;
    const key = normalizeCompany(record.company);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev || record.reapplyAfter > prev.reapplyAfter) {
      map.set(key, {
        company: record.company,
        reapplyAfter: record.reapplyAfter,
        reapplyNote: record.reapplyNote || '',
        reapplyMonths: record.reapplyMonths || null,
      });
    }
  }
  return map;
}

/** Look up a company's active cooldown (fuzzy, both directions) or null. */
export function cooldownForCompany(cooldownMap, company) {
  const needle = normalizeCompany(company);
  if (!needle || !cooldownMap || cooldownMap.size === 0) return null;
  const direct = cooldownMap.get(needle);
  if (direct) return direct;
  for (const [key, value] of cooldownMap) {
    if (key.includes(needle) || needle.includes(key)) return value;
  }
  return null;
}

const DATE_FMT_EN = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** 'YYYY-MM-DD' → human date. JA returns the ISO (matches the app's JA date style). */
export function formatReapplyDate(iso, isJa = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  if (isJa) return String(iso);
  const parsed = new Date(`${iso}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? iso : DATE_FMT_EN.format(parsed);
}

/** Short cooldown label, e.g. "Reapply from 12 Apr 2027". */
export function cooldownLabel(cooldown, isJa = false) {
  if (!cooldown?.reapplyAfter) return '';
  const date = formatReapplyDate(cooldown.reapplyAfter, isJa);
  return isJa ? `再応募は ${date} 以降` : `Reapply from ${date}`;
}
