/**
 * User truth outranks the pipeline — pins + tombstones.
 * contracts/tracker-record.md "User truth outranks the pipeline" · ADR-S-004.
 *
 * The tracker used to be a CACHE OF CLASSIFIER OUTPUT: whatever the owner did in
 * the app, the next re-derive could undo. They deleted a role they never applied
 * to and a rescan re-created it; they knew they had been rejected and the record
 * read "applied" until someone repaired the classifier. This module is the pure,
 * testable core of the two mechanisms that close that hole, so the drain
 * (useGmailInbox) and the store (useApplicationTracker) share ONE algorithm — and
 * so iOS's Swift implementation has a single set of rules to match. Behavioural
 * divergence between the clients corrupts shared user data.
 *
 *   Pins       — a status the user set by hand is never moved by a drain again.
 *   Tombstones — a deleted (companyKey, roleKey) is never re-created by a drain,
 *                until the owner re-applies to that exact pair.
 *
 * Keys are the SAME normalizers the drain and the cooldown map use
 * (reapplyCooldown.js, SPEC-per-role-keying §1/§2) — never re-derived here.
 *
 * Data only — no JSX, no React, no I/O. Unit-tested by trackerTruth.test.js.
 */
import { normalizeCompany, roleKey } from './reapplyCooldown.js';

/**
 * An ISO stamp → absolute instant, unparseable → the EPOCH (oldest).
 * SPEC-per-role-keying §6: stamps arrive in mixed offsets (iOS writes `+09:00`,
 * the wire writes UTC `Z`), so `2026-07-19T23:00:00+09:00` sorts AFTER
 * `2026-07-19T15:30:00Z` as a string while being the EARLIER instant. Tombstone
 * lifting compares an email's `receivedAt` against a tombstone's `at` — exactly
 * the mixed-offset pair — so it must compare instants. An unreadable value
 * becomes the epoch rather than falling back to string order, so it can never
 * outrank a real one (here: an unreadable tombstone is trivially lifted, which
 * fails towards keeping the owner's re-application rather than swallowing it).
 */
export const instantOf = value => {
  const t = Date.parse(String(value ?? ''));
  return Number.isNaN(t) ? 0 : t;
};

// ── pins ──────────────────────────────────────────────────────────

/** True when the OWNER set this record's status by hand. */
export const isPinned = record => record?.statusPinned === true;

/**
 * The fields a drain may still write to a PINNED record: detail enrichment only.
 * The status, the per-status stamps, `eventAt` and the milestones are the
 * owner's. Everything else on the record is round-tripped untouched.
 */
export const ENRICHABLE_FIELDS = ['applyUrl', 'location', 'deadline', 'deadlineDate', 'companyDomain', 'logoUrl'];

/**
 * Records the DRAIN owns, for §8's role-less resolution and for the rebuild
 * purge. A record is drain-owned when it says so (`source: 'gmail'`) or carries
 * a synthetic `gmail-` id.
 */
export const drainOwns = (trackerKey, record) =>
  record?.source === 'gmail' || String(trackerKey || '').startsWith('gmail-');

/**
 * The rebuild/purge predicate (ADR-S-004, item C). A rebuild deletes the records
 * it can re-derive from mail and keeps the hand-added ones. A PINNED record is
 * hand-added WHATEVER its `source` says: the owner typed that status, and a
 * purge that deletes it is the ADR-I-015 data-loss failure wearing a different
 * hat.
 *
 * Web has no rebuild path today (the purge lives in iOS's GmailDrain); this is
 * the shared predicate, kept here so the two clients cannot disagree about it
 * and so it is covered by tests on both sides.
 */
export const survivesRebuildPurge = (trackerKey, record) =>
  isPinned(record) || !drainOwns(trackerKey, record);

/**
 * Build the record a status write persists — and ENFORCE THE PIN here, in the
 * one place every write funnels through, rather than trusting each caller to
 * remember.
 *
 * `options.fromDrain` marks a write the Gmail drain is making. Against a pinned
 * record such a write may only enrich detail fields (`ENRICHABLE_FIELDS`): the
 * status, the per-status stamps, `eventAt`, `updatedAt`, `createdAt` and the
 * milestones are left exactly as the owner left them. Every other field is
 * round-tripped (contracts/tracker-record.md "the round-trip rule").
 *
 * `options.pin` marks a status the USER set by hand → `statusPinned: true`.
 * A drain NEVER clears the pin: clearing it is an explicit user action, so the
 * flag is only ever carried forward here, never dropped.
 */
export function nextTrackerRecord(prev, internship, status, options = {}) {
  if (options.fromDrain && isPinned(prev)) {
    const enriched = { ...prev };
    // Detail enrichment only, and only where the drain actually has a value —
    // an empty field from a rejection email must not blank a real one.
    if (internship.url) enriched.applyUrl = internship.url;
    if (internship.location) enriched.location = internship.location;
    if (internship.deadline && internship.deadline !== 'Not stated') enriched.deadline = internship.deadline;
    if (internship.deadlineDate) enriched.deadlineDate = internship.deadlineDate;
    if (internship.companyDomain) enriched.companyDomain = internship.companyDomain;
    if (internship.logoUrl) enriched.logoUrl = internship.logoUrl;
    return enriched;
  }
  // Per-status event timestamps (from the Gmail email date; see useGmailInbox).
  // Each is carried forward and only overwritten when a new value arrives.
  const appliedAt = internship.appliedAt ?? prev?.appliedAt ?? null;
  const rejectedAt = internship.rejectedAt ?? prev?.rejectedAt ?? null;
  const interviewAt = internship.interviewAt ?? prev?.interviewAt ?? null;
  const offerAt = internship.offerAt ?? prev?.offerAt ?? null;
  const now = options.now || new Date().toISOString();
  // updatedAt = this event's real date (Gmail) or now (in-app edit).
  const updatedAt = internship.eventAt || now;
  // createdAt = the EARLIEST known instant (first application, not the drain
  // time) so "when applied" is accurate. ISO strings sort chronologically.
  const createdAt = [prev?.createdAt, appliedAt, rejectedAt, interviewAt, offerAt, internship.eventAt]
    .filter(Boolean).sort()[0] || now;
  return {
    ...prev,
    internshipId: internship.id,
    company: internship.company,
    role: internship.role,
    location: internship.location,
    deadline: internship.deadline || 'Not stated',
    deadlineDate: internship.deadlineDate || null,
    applyUrl: internship.url,
    companyDomain: internship.companyDomain || '',
    logoUrl: internship.logoUrl || '',
    status,
    // Provenance: 'web' (added in-app) vs 'gmail' (ingested from the inbox).
    // A record keeps its origin once set; only a fresh Gmail action can stamp it.
    source: internship.source || prev?.source || 'web',
    sourceMeta: internship.sourceMeta || prev?.sourceMeta || null,
    appliedAt, rejectedAt, interviewAt, offerAt,
    // Reapplication cooldown (set by a Gmail rejection that states a wait
    // window). Carried forward unless a new value arrives, so re-tracking a
    // role doesn't wipe the company's stated cooldown.
    reapplyAfter: internship.reapplyAfter ?? prev?.reapplyAfter ?? null,
    reapplyNote: internship.reapplyNote ?? prev?.reapplyNote ?? '',
    reapplyMonths: internship.reapplyMonths ?? prev?.reapplyMonths ?? null,
    // A hand-set status pins the record; an existing pin is CARRIED FORWARD.
    // A drain can never clear it, so the flag only ever moves false → true here.
    statusPinned: options.pin === true || isPinned(prev),
    updatedAt,
    createdAt,
    milestones: Array.isArray(prev?.milestones) ? prev.milestones : [],
  };
}

// ── tombstones ────────────────────────────────────────────────────

/**
 * The tombstone list as persisted beside the tracker map:
 *   users/{uid}/trackers/{profileId}.tombstones = [ { companyKey, roleKey, at } ]
 * Anything malformed is dropped rather than trusted — a tombstone with no keys
 * would match nothing, and one that matched everything would silently suppress
 * the whole tracker.
 */
export const normalizeTombstones = list => (Array.isArray(list) ? list : [])
  .map(item => ({
    companyKey: String(item?.companyKey || ''),
    roleKey: String(item?.roleKey || ''),
    at: String(item?.at || ''),
  }))
  .filter(item => item.companyKey && item.roleKey);

/** The (companyKey, roleKey) pair a record is tombstoned under. */
export const tombstoneKeysFor = record => ({
  companyKey: normalizeCompany(record?.company),
  roleKey: roleKey(record?.role),
});

const matches = (item, companyKey, role) => item.companyKey === companyKey && item.roleKey === role;

/** The tombstone covering this pair, or null. */
export const findTombstone = (list, companyKey, role) =>
  normalizeTombstones(list).find(item => matches(item, companyKey, role)) || null;

/**
 * Append a tombstone for a deleted record. Re-deleting a pair replaces the older
 * entry rather than stacking duplicates, and the LATEST `at` wins — the list is
 * "when did the owner last say no to this pair", and an older stamp would let a
 * stale email lift a fresh deletion.
 */
export function addTombstone(list, companyKey, role, at) {
  if (!companyKey || !role) return normalizeTombstones(list);
  const stamp = String(at || new Date().toISOString());
  const rest = normalizeTombstones(list).filter(item => !matches(item, companyKey, role));
  const previous = findTombstone(list, companyKey, role);
  const newest = previous && instantOf(previous.at) > instantOf(stamp) ? previous.at : stamp;
  return [...rest, { companyKey, roleKey: role, at: newest }];
}

/** Remove a pair's tombstone (the owner re-applied — see `tombstoneGate`). */
export const removeTombstone = (list, companyKey, role) =>
  normalizeTombstones(list).filter(item => !matches(item, companyKey, role));

/**
 * The gate every drain passes through BEFORE CREATING a record.
 *
 *   'create' — no tombstone, or none for this pair: create it.
 *   'skip'   — tombstoned: the owner deleted this (company, role) and a
 *              re-derive must not resurrect it.
 *   'lift'   — the owner RE-APPLIED: an `applied` action whose evidence is NEWER
 *              than the tombstone's `at`. The caller removes the tombstone and
 *              creates the record, so a deletion is permanent against re-derives
 *              without making the company permanently un-trackable.
 *
 * `receivedAt` is compared as an instant, never as a string (see `instantOf`).
 * Strictly newer: an action at exactly the tombstone's instant is the mail the
 * owner was looking at WHEN they deleted the row, and must not undo it.
 *
 * Only `kind: 'applied'` lifts. The contract names the applied action and is
 * silent on `offer`; an offer for a role the owner deleted is far likelier to be
 * a mis-classification than a re-application, and the conservative reading keeps
 * the deletion. Both clients must agree here.
 */
export function tombstoneGate(list, companyKey, role, action) {
  const tombstone = findTombstone(list, companyKey, role);
  if (!tombstone) return 'create';
  const lifts = action?.kind === 'applied' && instantOf(action?.receivedAt) > instantOf(tombstone.at);
  return lifts ? 'lift' : 'skip';
}
