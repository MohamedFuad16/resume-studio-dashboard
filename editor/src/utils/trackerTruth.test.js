/**
 * Pins + tombstones — contracts/tracker-record.md "User truth outranks the
 * pipeline" · ADR-S-004.
 *
 * These are the falsifiable statements of the contract. iOS implements the same
 * rules in Swift; a behavioural divergence corrupts shared user data, so every
 * assertion here is one both clients must satisfy.
 *
 * Run: npm run test:tracker  (or npm test, which runs the whole suite)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTombstone, drainOwns, findTombstone, isPinned, nextTrackerRecord,
  normalizeTombstones, removeTombstone, survivesRebuildPurge, tombstoneGate,
  tombstoneKeysFor,
} from './trackerTruth.js';

// A record the Gmail drain created and the owner then corrected by hand: the
// classifier said "applied", the owner knows they were rejected.
const pinnedRecord = () => ({
  internshipId: 'gmail-hennge-global-internship-program',
  company: 'HENNGE',
  role: 'Global Internship Program',
  status: 'rejected',
  statusPinned: true,
  source: 'gmail',
  appliedAt: '2026-05-01T00:00:00.000Z',
  rejectedAt: '2026-06-01T00:00:00.000Z',
  interviewAt: null,
  offerAt: null,
  eventAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  createdAt: '2026-05-01T00:00:00.000Z',
  milestones: [{ id: 'gmail-m1', kind: 'interview', date: '2026-05-20', time: '10:00', timeZone: 'Asia/Tokyo', title: 'Interview — HENNGE', createdAt: '2026-05-10T00:00:00.000Z' }],
  reapplyAfter: '2027-03-01',
  someFieldOnlyIosModels: 'must survive',
});

// What the drain hands the store for a re-classified "interview" email that
// would, unpinned, move the record backwards from the owner's "rejected".
const drainWrite = {
  id: 'gmail-hennge-global-internship-program',
  company: 'HENNGE',
  role: 'Global Internship Program',
  location: 'Tokyo',
  deadline: 'Not stated',
  url: 'https://hennge.com/apply',
  companyDomain: 'hennge.com',
  logoUrl: 'https://logo.example/hennge.png',
  source: 'gmail',
  eventAt: '2026-07-01T00:00:00.000Z',
  interviewAt: '2026-07-01T00:00:00.000Z',
  sourceMeta: { gmailMessageId: 'm2', receivedAt: '2026-07-01T00:00:00.000Z', subject: 'Interview' },
};

test('A — a pinned record survives a drain that would otherwise change its status', () => {
  const prev = pinnedRecord();
  const next = nextTrackerRecord(prev, drainWrite, 'interview', { fromDrain: true });

  assert.equal(next.status, 'rejected', 'the drain must not move a pinned status');
  assert.equal(next.statusPinned, true, 'a drain never clears the pin');
  // Per-status stamps, eventAt and milestones are the owner's too.
  assert.equal(next.appliedAt, prev.appliedAt);
  assert.equal(next.rejectedAt, prev.rejectedAt);
  assert.equal(next.interviewAt, null, 'a drained stamp must not land on a pinned record');
  assert.equal(next.offerAt, null);
  assert.equal(next.eventAt, prev.eventAt);
  assert.deepEqual(next.milestones, prev.milestones);
  assert.equal(next.updatedAt, prev.updatedAt);
  // Detail enrichment IS still allowed.
  assert.equal(next.applyUrl, 'https://hennge.com/apply');
  assert.equal(next.location, 'Tokyo');
  assert.equal(next.companyDomain, 'hennge.com');
  assert.equal(next.logoUrl, 'https://logo.example/hennge.png');
  // …and everything else round-trips, including fields only the other client models.
  assert.equal(next.someFieldOnlyIosModels, 'must survive');
  assert.equal(next.reapplyAfter, '2027-03-01');
});

test('A — an empty enrichment value never blanks a real one on a pinned record', () => {
  const prev = { ...pinnedRecord(), location: 'Tokyo', applyUrl: 'https://hennge.com/apply' };
  const next = nextTrackerRecord(prev, { ...drainWrite, location: '', url: '', deadline: 'Not stated' }, 'interview', { fromDrain: true });
  assert.equal(next.location, 'Tokyo');
  assert.equal(next.applyUrl, 'https://hennge.com/apply');
  assert.equal(next.deadline, prev.deadline);
});

test('A — an UNPINNED record is still moved by the drain (the pin is the only brake)', () => {
  const prev = { ...pinnedRecord(), statusPinned: false };
  const next = nextTrackerRecord(prev, drainWrite, 'interview', { fromDrain: true });
  assert.equal(next.status, 'interview');
  assert.equal(next.interviewAt, '2026-07-01T00:00:00.000Z');
});

test('A — a hand-set status pins the record, and the pin then carries forward', () => {
  const created = nextTrackerRecord(undefined, { id: 'x', company: 'Rakuten', role: 'TECH Camp' }, 'rejected', { pin: true });
  assert.equal(created.statusPinned, true);
  assert.equal(created.status, 'rejected');
  // A later write that does not mention the pin must not drop it.
  const later = nextTrackerRecord(created, { id: 'x', company: 'Rakuten', role: 'TECH Camp' }, 'rejected');
  assert.equal(later.statusPinned, true);
  // And a record nobody pinned stays unpinned.
  assert.equal(nextTrackerRecord(undefined, { id: 'y', company: 'Acme', role: 'Intern' }, 'saved').statusPinned, false);
});

test('C — a pinned record survives a rebuild purge, whatever its source says', () => {
  const gmailPinned = pinnedRecord();
  const key = 'gmail-hennge-global-internship-program';
  assert.equal(drainOwns(key, gmailPinned), true, 'it IS drain-owned by source');
  assert.equal(survivesRebuildPurge(key, gmailPinned), true, 'but the pin makes it hand-added for the purge');

  // The unpinned Gmail row is exactly what a rebuild is allowed to purge…
  assert.equal(survivesRebuildPurge(key, { ...gmailPinned, statusPinned: false }), false);
  // …and a hand-added row survives as it always did.
  assert.equal(survivesRebuildPurge('cat-123', { company: 'Acme', source: 'web' }), true);
});

test('B — deleting a record tombstones its (companyKey, roleKey) pair', () => {
  const keys = tombstoneKeysFor({ company: '株式会社HENNGE', role: 'Global Internship Program' });
  assert.deepEqual(keys, { companyKey: 'hennge', roleKey: 'global internship program' });

  const list = addTombstone([], keys.companyKey, keys.roleKey, '2026-07-10T00:00:00.000Z');
  assert.deepEqual(list, [{ companyKey: 'hennge', roleKey: 'global internship program', at: '2026-07-10T00:00:00.000Z' }]);
  assert.ok(findTombstone(list, 'hennge', 'global internship program'));
  // A different ROLE at the same company is a different application entirely.
  assert.equal(findTombstone(list, 'hennge', 'internship'), null);
});

test('B — a tombstoned (company, role) is not re-created by a drain', () => {
  const list = addTombstone([], 'hennge', 'global internship program', '2026-07-10T00:00:00.000Z');
  const rejection = { kind: 'rejected', receivedAt: '2026-07-15T00:00:00.000Z' };
  const interview = { kind: 'interview', receivedAt: '2026-07-15T00:00:00.000Z' };
  const staleApplied = { kind: 'applied', receivedAt: '2026-07-01T00:00:00.000Z' };

  assert.equal(tombstoneGate(list, 'hennge', 'global internship program', rejection), 'skip');
  assert.equal(tombstoneGate(list, 'hennge', 'global internship program', interview), 'skip',
    'only an applied action lifts — a newer rejection must not resurrect the row');
  assert.equal(tombstoneGate(list, 'hennge', 'global internship program', staleApplied), 'skip');
  // An untombstoned pair is unaffected.
  assert.equal(tombstoneGate(list, 'hennge', 'internship', rejection), 'create');
  assert.equal(tombstoneGate([], 'hennge', 'global internship program', rejection), 'create');
});

test('B — a NEWER applied action lifts the tombstone; an OLDER one does not', () => {
  const at = '2026-07-10T00:00:00.000Z';
  const list = addTombstone([], 'hennge', 'global internship program', at);
  const gate = action => tombstoneGate(list, 'hennge', 'global internship program', action);

  assert.equal(gate({ kind: 'applied', receivedAt: '2026-07-11T00:00:00.000Z' }), 'lift');
  assert.equal(gate({ kind: 'applied', receivedAt: '2026-07-09T00:00:00.000Z' }), 'skip');
  // Exactly the tombstone's instant is the mail the owner was looking at when
  // they deleted the row — it must not undo the deletion.
  assert.equal(gate({ kind: 'applied', receivedAt: at }), 'skip');
  // §6 — compared as INSTANTS. `2026-07-10T08:00:00+09:00` sorts AFTER the
  // tombstone as a string but is the EARLIER instant (23:00 the day before).
  assert.equal(gate({ kind: 'applied', receivedAt: '2026-07-10T08:00:00+09:00' }), 'skip');
  assert.equal(gate({ kind: 'applied', receivedAt: '2026-07-10T10:00:00+09:00' }), 'lift');

  const lifted = removeTombstone(list, 'hennge', 'global internship program');
  assert.deepEqual(lifted, [], 'lifting removes the tombstone so the record can be created');
});

test('B — re-deleting a pair keeps the NEWEST stamp and never stacks duplicates', () => {
  let list = addTombstone([], 'acme', 'intern', '2026-07-10T00:00:00.000Z');
  list = addTombstone(list, 'acme', 'intern', '2026-07-20T00:00:00.000Z');
  assert.equal(list.length, 1);
  assert.equal(list[0].at, '2026-07-20T00:00:00.000Z');
  // An older re-write must not weaken a fresher deletion.
  list = addTombstone(list, 'acme', 'intern', '2026-07-01T00:00:00.000Z');
  assert.equal(list[0].at, '2026-07-20T00:00:00.000Z');
});

test('B — an un-keyable company is never tombstoned, and junk entries are dropped', () => {
  // A company that normalizes to nothing would otherwise write a wildcard entry.
  assert.deepEqual(addTombstone([], '', 'intern', '2026-07-10T00:00:00.000Z'), []);
  assert.deepEqual(normalizeTombstones([{ roleKey: 'intern', at: 'x' }, null, { companyKey: 'acme' }]), []);
  assert.deepEqual(
    normalizeTombstones([{ companyKey: 'acme', roleKey: 'intern', at: '2026-07-10T00:00:00.000Z' }]),
    [{ companyKey: 'acme', roleKey: 'intern', at: '2026-07-10T00:00:00.000Z' }],
  );
});

test('helpers — isPinned is strict about the flag', () => {
  assert.equal(isPinned({ statusPinned: true }), true);
  assert.equal(isPinned({ statusPinned: 'yes' }), false);
  assert.equal(isPinned({}), false);
  assert.equal(isPinned(null), false);
});
