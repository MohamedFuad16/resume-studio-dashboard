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

// Canonical company key (contracts/normalization.md §1) — the ONE normalizer the
// tracker, the Gmail drain (useGmailInbox imports these), and iOS's GmailDrain
// must all implement identically, or the same company lands on two records
// depending on which client drained first. It strips JA corporate markers AND EN
// suffixes so "株式会社HENNGE", "HENNGE", "hennge" collapse to one key, and
// "Acme, Inc." / "Acme Co., Ltd." / "Acme" all key as "acme".
const CORP_JA = /株式会社|合同会社|有限会社|\(株\)|（株）/g;
// A trailing corporate suffix: an optional comma, a separator, then one of the
// canonical tokens (inc, ltd, k.k., co) with an optional period, at the end. The
// required leading separator protects single-token names ("Cisco"/"Costco" keep
// their "co"). Applied repeatedly to peel stacked suffixes ("Co., Ltd.").
const CORP_EN_SUFFIX = /[,\s]+(?:inc|ltd|k\.?k|co)\.?\s*$/i;
function stripCorp(value) {
  let out = String(value || '').replace(CORP_JA, '');
  let previous;
  do { previous = out; out = out.replace(CORP_EN_SUFFIX, ''); } while (out !== previous);
  return out;
}
export const normalizeCompany = value =>
  stripCorp(value).toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/gu, ' ').trim();
// Synthetic tracker id slug = the company key with spaces as dashes (so the id
// derives from the SAME key as matching — they can never disagree).
export const companySlug = value => normalizeCompany(value).replace(/\s+/g, '-');

/**
 * Add `months` calendar months to an ISO date/instant → 'YYYY-MM-DD' (or null),
 * computed in Asia/Tokyo per contracts/normalization.md §5 (the cooldown clock is
 * JST). The month arithmetic runs on the record's Tokyo civil date, so the result
 * does NOT depend on the browser's timezone and matches iOS's GmailDrain
 * (`tokyoCalendar.date(byAdding:.month)` + Tokyo `dayKey`). The previous version
 * mixed local-time arithmetic with a `toISOString().slice(0,10)` UTC readout, which
 * produced a date one day early for any email received before 09:00 JST — a value
 * that also varied with the browser's zone, so the phone and the browser stamped
 * different `reapplyAfter` dates for the same rejection.
 */
// Built once — the Tokyo civil-date reader for addMonths (constructing an
// Intl.DateTimeFormat per call is the expensive part).
const TOKYO_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function addMonths(instant, months) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  // The email's civil Y-M-D in Tokyo — the clock the contract mandates.
  const parts = TOKYO_PARTS.formatToParts(date);
  const val = type => Number(parts.find(part => part.type === type).value);
  const total = (val('month') - 1) + Number(months || 0); // 0-based month index
  const year = val('year') + Math.floor(total / 12);
  const monthIdx = ((total % 12) + 12) % 12;
  // Clamp month-end overflow (e.g. Jan 31 + 1 → Feb 28), as Foundation's Calendar
  // does. Date.UTC only reads the day-count of the target month (zone-independent).
  const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const day = Math.min(val('day'), lastDay);
  const pad = (num, width) => String(num).padStart(width, '0');
  return `${pad(year, 4)}-${pad(monthIdx + 1, 2)}-${pad(day, 2)}`;
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
