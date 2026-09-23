// The activity period ("last 2 weeks", "last 3 months", …) shared by the
// Dashboard, Applications and the Gmail scan. One module-level value behind
// useSyncExternalStore so every view changes together, persisted per browser.
import { useSyncExternalStore } from 'react';

export const PERIOD_UNITS = ['weeks', 'months', 'years'];
const UNIT_DAYS = { weeks: 7, months: 30, years: 365 };
const UNIT_MAX = { weeks: 12, months: 24, years: 2 };
// The server caps a Gmail backfill at 730 days; the picker never asks for more.
export const MAX_PERIOD_DAYS = 730;
const DEFAULT_PERIOD = { amount: 2, unit: 'weeks' };
const LS_KEY = 'resume-studio:activity-period';

export function normalizePeriod(value) {
  const unit = PERIOD_UNITS.includes(value?.unit) ? value.unit : DEFAULT_PERIOD.unit;
  const amount = Math.min(UNIT_MAX[unit], Math.max(1, Math.round(Number(value?.amount) || DEFAULT_PERIOD.amount)));
  return { amount, unit };
}

export const periodDays = period => Math.min(MAX_PERIOD_DAYS, period.amount * UNIT_DAYS[period.unit]);
export const periodMaxAmount = unit => UNIT_MAX[unit];

function readStored() {
  try { return normalizePeriod(JSON.parse(localStorage.getItem(LS_KEY) || 'null') || DEFAULT_PERIOD); } catch { return DEFAULT_PERIOD; }
}

let current = readStored();
const listeners = new Set();

export function setActivityPeriod(next) {
  current = normalizePeriod(next);
  try { localStorage.setItem(LS_KEY, JSON.stringify(current)); } catch { /* private mode */ }
  listeners.forEach(fn => fn());
}

const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const snapshot = () => current;

// A record's most recent dated event: the application, the reply, or the latest
// email. Filtering on the latest event keeps an old application that was
// rejected this week inside "last 2 weeks". `updatedAt` counts only for records
// with no event stamp at all (hand-added ones): adding a milestone rewrites it to
// "now", which would make a 2025 interview found by a wide scan look recent.
const EVENT_FIELDS = ['eventAt', 'appliedAt', 'interviewAt', 'rejectedAt', 'offerAt', 'createdAt'];
export function recordActivityTime(record) {
  let best = 0;
  for (const raw of [...EVENT_FIELDS.map(f => record[f]), record.sourceMeta?.receivedAt]) {
    const ms = raw ? Date.parse(raw) : NaN;
    if (Number.isFinite(ms) && ms > best) best = ms;
  }
  if (!best && record.updatedAt) {
    const ms = Date.parse(record.updatedAt);
    if (Number.isFinite(ms)) best = ms;
  }
  return best || null;
}

// Undated records stay visible: hiding them would lose rows the period cannot judge.
export function filterRecordsByPeriod(records, period, now = Date.now()) {
  const since = now - periodDays(period) * 86400000;
  return records.filter(record => {
    const at = recordActivityTime(record);
    return at === null || at >= since;
  });
}

export function useActivityPeriod() {
  const period = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { period, days: periodDays(period), setPeriod: setActivityPeriod };
}
