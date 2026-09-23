import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterRecordsByPeriod, normalizePeriod, periodDays, recordActivityTime } from './useActivityPeriod.js';

const NOW = Date.parse('2026-09-24T03:00:00Z');
const daysAgo = n => new Date(NOW - n * 86400000).toISOString();
const rec = (id, days, extra = {}) => ({ id, status: 'applied', appliedAt: daysAgo(days), updatedAt: daysAgo(days), ...extra });

test('two weeks keeps only records active in the last 14 days', () => {
  const records = [rec('a', 6), rec('b', 10), rec('c', 35), rec('d', 240)];
  const ids = filterRecordsByPeriod(records, { amount: 2, unit: 'weeks' }, NOW).map(r => r.id);
  assert.deepEqual(ids, ['a', 'b']);
});

test('an old application with a recent rejection stays in the period', () => {
  const records = [rec('old', 200, { status: 'rejected', rejectedAt: daysAgo(3), updatedAt: daysAgo(3) })];
  assert.equal(filterRecordsByPeriod(records, { amount: 2, unit: 'weeks' }, NOW).length, 1);
});

test('a milestone touching updatedAt does not make an old record recent', () => {
  const old = rec('old', 400, { updatedAt: daysAgo(0) });
  assert.equal(filterRecordsByPeriod([old], { amount: 2, unit: 'weeks' }, NOW).length, 0);
  // A hand-added record with only updatedAt still counts by it.
  assert.equal(filterRecordsByPeriod([{ id: 'h', updatedAt: daysAgo(1) }], { amount: 2, unit: 'weeks' }, NOW).length, 1);
});

test('undated records are kept', () => {
  assert.equal(filterRecordsByPeriod([{ id: 'x', status: 'saved' }], { amount: 1, unit: 'weeks' }, NOW).length, 1);
  assert.equal(recordActivityTime({ createdAt: 'not a date' }), null);
});

test('months and years widen the window; amounts clamp to the unit maximum', () => {
  const records = [rec('a', 6), rec('c', 35), rec('d', 240)];
  assert.equal(filterRecordsByPeriod(records, { amount: 2, unit: 'months' }, NOW).length, 2);
  assert.equal(filterRecordsByPeriod(records, { amount: 1, unit: 'years' }, NOW).length, 3);
  assert.deepEqual(normalizePeriod({ amount: 50, unit: 'years' }), { amount: 2, unit: 'years' });
  assert.deepEqual(normalizePeriod({ amount: 0, unit: 'bogus' }), { amount: 2, unit: 'weeks' });
  assert.equal(periodDays({ amount: 2, unit: 'years' }), 730);
});
