import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJson } from '../api/client.js';
import { useApplicationTracker } from './useApplicationTracker.js';
import { useInternshipCatalog } from './useInternshipCatalog.js';
import {
  addMonths, normalizeCompany, roleKey, gmailRecordId, sessionKeyFor, GENERAL_ROLE,
} from '../utils/reapplyCooldown.js';
import {
  drainOwns, instantOf, isPinned, tombstoneGate,
} from '../utils/trackerTruth.js';

const POLL_MS = 90000;
const KIND_TO_STATUS = { applied: 'applied', rejected: 'rejected', interview: 'interview', offer: 'applied' };
// Status precedence within one drain: a terminal outcome (rejected) must not be
// overwritten by an earlier application/interview email for the same company.
// UNCHANGED by the per-role change (SPEC-per-role-keying §5) — ranking was never
// the bug; per-company collapsing was.
const STATUS_RANK = { saved: 0, applying: 1, applied: 1, interview: 2, rejected: 3 };
// A record at a terminal status is closed: a role-less rejection should land on
// an application still in flight, not on one already closed (§3).
const TERMINAL_STATUSES = new Set(['rejected']);
// The canonical company/role keys live in reapplyCooldown.js so this drain and
// the cooldown map (and iOS's GmailDrain, via contracts/normalization.md §1) share
// ONE algorithm — NFKC-normalizing, CJK-preserving (株式会社カナリー must not
// normalize to empty) and EN-suffix-stripping ("Acme, Inc." keys the same as "Acme").
const norm = normalizeCompany;

// Deterministic scan order for every "find the existing record" pass (§4). Plain
// code-unit comparison, NOT localeCompare: iOS orders the same ids with Swift's
// `<`, and a locale-aware collation would disagree with it on the non-ASCII ids
// a Japanese company name produces.
const compareIds = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byId = (items, idOf) => (items || []).toSorted((a, b) => compareIds(String(idOf(a)), String(idOf(b))));
// Tracker entries `[key, record]` in deterministic key order (§4/§7). The KEY is
// the stable identity — see `trackerKey` below.
const byTrackerKey = entries => (entries || []).toSorted((a, b) => compareIds(String(a[0]), String(b[0])));

// §6 — `updatedAt` is compared as an INSTANT, never as a string; and §8 — the
// records the DRAIN owns (role-less resolution never captures a hand-added row,
// and `source` is never rewritten on one). Both live in trackerTruth.js, shared
// with the tracker store so the pin/tombstone rules and the drain read the same
// definitions. See that module for why an unparseable stamp becomes the epoch.

// Stable empty seeds for the refs the drain reads (see useGmailInbox).
const EMPTY_ENTRIES = [];
const EMPTY_TOMBSTONES = [];

// Most recently updated candidate; on an equal `updatedAt` the LOWEST TRACKER
// KEY wins (§7). The tie-break is the tracker dictionary key — stable, and
// already the sort key — never a derived `record.id`: iOS builds that as
// `internshipId ?? UUID().uuidString`, so a record stored without
// `internshipId` yields a FRESH id on every evaluation, making this comparator
// non-deterministic inside the very function §4 exists to make deterministic.
// The tie-break lives in the comparator rather than relying on sort stability —
// neither Swift's sort nor every JS engine documents it.
const mostRecent = candidates =>
  candidates.reduce((best, c) => {
    if (!best) return c;
    const at = instantOf(c.updatedAt);
    const bt = instantOf(best.updatedAt);
    if (at !== bt) return at > bt ? c : best;
    return compareIds(c.trackerKey, best.trackerKey) < 0 ? c : best;
  }, null);

// A tracker record → the internship base the drain mutates. `_rank`/`_status`
// carry the record's current status so it is never downgraded, `_updatedAt` is
// what §3 orders candidates by, `_owned` is §8's provenance guard.
//
// `id` falls back to the TRACKER KEY: `updateStatus` writes back to
// `next[internship.id]`, and a record stored without `internshipId` would
// otherwise be written to `next[undefined]` — the same missing-backfill defect
// §7 names on iOS.
const baseFromRecord = (trackerKey, record) => ({
  id: record.internshipId || trackerKey,
  company: record.company,
  role: record.role,
  location: record.location,
  deadline: record.deadline,
  deadlineDate: record.deadlineDate,
  url: record.applyUrl,
  companyDomain: record.companyDomain,
  logoUrl: record.logoUrl,
  _rank: STATUS_RANK[record.status] ?? 0,
  _status: record.status,
  _updatedAt: record.updatedAt || '',
  _owned: drainOwns(trackerKey, record),
  // The OWNER set this status by hand — the drain may enrich its details but
  // must never move its status, stamps or milestones (ADR-S-004). The guard is
  // enforced again inside the tracker store, so this flag only decides what the
  // drain bothers to do (chiefly: skip the interview milestone).
  _pinned: isPinned(record),
});

/**
 * §3 — resolve an action that names NO role onto one of the company's existing
 * records. Rejection mail routinely omits the role ("we will not be moving
 * forward"), and creating a `<company>-general` row for it would sit a phantom
 * beside the real application.
 *
 * Candidates = every DRAIN-OWNED record for this company (§8), whether created
 * earlier in THIS drain (session) or already in the tracker; the session wins on
 * key collision because it holds the fresher status. Sorted by tracker key, so
 * ties resolve identically on every run.
 *
 * A hand-added record is NOT a candidate: capturing it would stamp it
 * `source: 'gmail'` and hand it to the next rebuild purge to delete (§8). If a
 * company's only record was typed by hand we fall through and create
 * `<company>-general` beside it instead.
 *
 *   1. exactly one record  → that one
 *   2. several             → the most recently updated NON-terminal one
 *   3. all terminal        → the most recently updated one
 *   4. none                → null (the caller creates `<company>-general`)
 */
function resolveRolelessTarget(companyKey, session, entries) {
  const prefix = `${companyKey}|`;
  const seen = new Map(); // tracker key -> { key, trackerKey, base, status, updatedAt }
  for (const [sessionKey, base] of session) {
    if (!sessionKey.startsWith(prefix)) continue;
    // Session bases are drain-created or already §8-checked by the branch that
    // put them there, so they need no further ownership test.
    const trackerKey = String(base.id);
    seen.set(trackerKey, { key: sessionKey, trackerKey, base, status: base._status, updatedAt: base._updatedAt || '' });
  }
  for (const [rawKey, record] of entries || []) {
    if (norm(record.company) !== companyKey) continue;
    if (!drainOwns(rawKey, record)) continue; // §8 — never capture a hand-added row
    const trackerKey = String(rawKey);
    if (seen.has(trackerKey)) continue; // the session copy is fresher
    seen.set(trackerKey, {
      key: sessionKeyFor(companyKey, roleKey(record.role)),
      trackerKey,
      base: baseFromRecord(trackerKey, record),
      status: record.status,
      updatedAt: record.updatedAt || '',
    });
  }
  const candidates = byId([...seen.values()], c => c.trackerKey);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const inFlight = candidates.filter(c => !TERMINAL_STATUSES.has(c.status));
  return mostRecent(inFlight.length ? inFlight : candidates);
}

// Drains the server-side Gmail action queue into the Firestore-backed tracker /
// calendar. Runs full-auto: on load and on an interval while the tab is open, it
// syncs the inbox, applies each action, and acks it. Mount ONCE (in App).
export function useGmailInbox(profile) {
  // The tracker OBJECT, not the flattened `records` array: §7 tie-breaks on the
  // tracker dictionary KEY, and only the object carries it.
  const { tracker, tombstones, updateStatus, addMilestone } = useApplicationTracker(profile);
  const { catalog } = useInternshipCatalog();
  const [justApplied, setJustApplied] = useState([]);
  // Seeded by the effect below, not by an initializer: an eager
  // `useRef(Object.entries(...))` rebuilds and discards the array on every
  // render. The effect runs on mount, long before the drain's 1.5s timer.
  const entriesRef = useRef(EMPTY_ENTRIES);
  const catalogRef = useRef(catalog);
  const busy = useRef(false);
  // Keep the latest values for the async drain without retriggering it. Written
  // in an effect (not during render): React may replay/discard render work, and
  // the drain only reads these after commit anyway.
  const tombstonesRef = useRef(EMPTY_TOMBSTONES);
  useEffect(() => { entriesRef.current = Object.entries(tracker || {}); }, [tracker]);
  useEffect(() => { catalogRef.current = catalog; }, [catalog]);
  useEffect(() => { tombstonesRef.current = tombstones || EMPTY_TOMBSTONES; }, [tombstones]);

  const applyAction = useCallback((action, session) => {
    const status = KIND_TO_STATUS[action.kind];
    if (!status) return null;
    const companyNeedle = norm(action.company);
    // An empty key means the application is about to be dropped — never silently.
    // Before NFKC this swallowed every full-width-Latin company name; if it still
    // happens the raw string is the only evidence of what was lost (§1).
    if (!companyNeedle) {
      console.warn('[gmail-drain] company name normalizes to an empty key — action skipped. Raw company:', JSON.stringify(action.company ?? null));
      return null;
    }

    // Records are keyed by the PAIR (companyKey, roleKey) (§2). Reuse a base
    // resolved earlier in THIS drain, else an existing tracked record, else a
    // catalog listing for details, else a synthetic per-role entry.
    const actionRole = roleKey(action.role);
    let key = sessionKeyFor(companyNeedle, actionRole);
    let base = session.get(key);
    if (!base && actionRole === GENERAL_ROLE) {
      // §3 — an action carrying no role must NOT spawn a phantom
      // "<company>-general" row beside the real one. Resolve it onto an existing
      // record for the same company instead, preferring one still in flight.
      const target = resolveRolelessTarget(companyNeedle, session, entriesRef.current);
      // Bind the resolved record under ITS OWN (company, role) key, so a second
      // role-less email in the same drain lands on the same record.
      if (target) { key = target.key; base = target.base; session.set(key, base); }
    }
    let lift = null;
    if (!base) {
      // §4 — EXACT companyKey equality, never a substring test (substrings merge
      // genuinely different companies whose keys nest), over a collection sorted
      // by id so repeated runs over the same data resolve identically.
      const existing = byTrackerKey(entriesRef.current)
        .find(([, r]) => norm(r.company) === companyNeedle && roleKey(r.role) === actionRole);
      if (!existing) {
        // TOMBSTONES (ADR-S-004) — this branch is about to CREATE a record, so
        // it is exactly where the deleted-pair list is consulted. The owner
        // deleted this (company, role); a re-derive must not resurrect it. Only
        // re-applying lifts it: an `applied` action with evidence NEWER than the
        // tombstone. `lift` is passed to the write below so the tombstone
        // removal and the re-creation land in ONE save.
        const gate = tombstoneGate(tombstonesRef.current, companyNeedle, actionRole, action);
        if (gate === 'skip') return null;
        // Carry the GATED keys to the write: a role-less action stores
        // `role: 'Application'` on the record while its tombstone is keyed
        // `general`, so re-deriving the pair at write time would miss it.
        if (gate === 'lift') lift = { companyKey: companyNeedle, roleKey: actionRole };
      }
      // A role-carrying action NEVER fuzzy-matches another role ("TECH Camp" vs
      // "TECH Camp 2026" are different applications) — it creates the record if
      // absent. The catalog listing must match BOTH keys for the same reason:
      // matching on company alone would hand every role at that company one
      // shared listing id, which is precisely the collapse §2 exists to stop.
      // Kept in lockstep with iOS by the 2026-07-20 parity bulletin — the spec
      // itself is silent on the catalog branch.
      const catItem = existing
        ? null
        : byId(catalogRef.current, i => i.id).find(i => norm(i.company) === companyNeedle && roleKey(i.role) === actionRole);
      // A base the drain CREATES (catalog listing or synthetic gmail- id) is
      // drain-owned; one read back from an existing record inherits that
      // record's provenance, so a hand-added row keeps `source: 'web'` (§8).
      base = existing
        ? baseFromRecord(existing[0], existing[1])
        : catItem
          ? { id: catItem.id, company: catItem.company, role: catItem.role, location: catItem.location, deadline: catItem.deadline, deadlineDate: catItem.deadlineDate, url: catItem.url, companyDomain: catItem.companyDomain, logoUrl: catItem.logoUrl, _owned: true }
          : { id: gmailRecordId(action.company, action.role), company: action.company, role: action.role || 'Application', location: action.enrichment?.location || '', deadline: action.enrichment?.deadline || 'Not stated', deadlineDate: action.enrichment?.deadlineDate || null, url: action.enrichment?.url || '', _owned: true };
      // Statuses are monotonic across drains too: a record already at
      // "interview" can't be pulled back to "applied" by a re-classified email.
      session.set(key, base);
    }
    // Backfill better details from whichever email has them (the application email
    // usually carries the role/URL the rejection email lacks).
    if ((!base.role || base.role === 'Application') && action.role) base.role = action.role;
    if (!base.url && action.enrichment?.url) {
      base.url = action.enrichment.url;
      base.location = base.location || action.enrichment.location;
      if (base.deadline === 'Not stated' && action.enrichment.deadline) base.deadline = action.enrichment.deadline;
    }

    // Don't downgrade a terminal outcome (a rejection already applied this drain
    // wins over a later-processed application). Interview milestones still land.
    //
    // A PINNED record short-circuits all of it: the owner's status stands, and
    // the session copy keeps it too, so a later role-less action in the same
    // drain orders candidates on the owner's truth rather than on a status this
    // drain pretended to set (ADR-S-004).
    const rank = STATUS_RANK[status] ?? 0;
    const shouldSetStatus = !base._pinned && (base._rank == null || rank >= base._rank);
    if (shouldSetStatus) { base._rank = rank; base._status = status; }
    const persistStatus = base._status || status;
    // The real email date for this event → per-status timestamp, so "when
    // applied / rejected / interviewed" reflects the email, not the drain time.
    // eventAt drives the record's updatedAt/createdAt in updateStatus.
    const eventAt = (() => { const d = new Date(action.receivedAt); return Number.isNaN(d.getTime()) ? null : d.toISOString(); })();
    // Keep the session copy's updatedAt in step with what updateStatus will
    // persist, so a role-less action later in this drain orders candidates on
    // the same values §3 would read back from the tracker.
    // Compared as INSTANTS (§6) — `eventAt` is always UTC `Z` while a stored
    // `updatedAt` may carry `+09:00`, and a string compare gets the order wrong.
    if (eventAt && instantOf(eventAt) > instantOf(base._updatedAt)) base._updatedAt = eventAt;
    const { _rank, _status, _updatedAt, _owned, _pinned, ...cleanBase } = base;
    const stampKey = { applied: 'appliedAt', rejected: 'rejectedAt', interview: 'interviewAt', offer: 'offerAt' }[action.kind];
    // §8 — `source` is stamped ONLY on a record the drain created. Rewriting it
    // on a hand-added row would mark it Gmail-derived, and the next rebuild
    // purge would delete a row Gmail cannot re-derive. `updateStatus` carries
    // `prev.source` forward when the field is absent.
    const internship = { ...cleanBase, sourceMeta: { gmailMessageId: action.gmailMessageId, receivedAt: action.receivedAt, subject: action.subject } };
    if (_owned) internship.source = 'gmail';
    if (eventAt) {
      internship.eventAt = eventAt;
      if (stampKey) internship[stampKey] = eventAt;
    }
    // Rejection with a stated wait window → stamp a company-wide reapply cooldown.
    // reapplyAfter = the rejection's receipt date + the minimum stated months
    // (the earliest the company says you may reapply).
    if (action.kind === 'rejected' && action.reapplyMonths?.min) {
      const { min, max } = action.reapplyMonths;
      const after = addMonths(action.receivedAt || Date.now(), min);
      if (after) {
        internship.reapplyAfter = after;
        internship.reapplyMonths = { min, max: max || min };
        internship.reapplyNote = max && max !== min
          ? `${action.company} asks applicants to wait ${min}–${max} months before reapplying.`
          : `${action.company} asks applicants to wait ${min} months before reapplying.`;
      }
    }
    // Always persist — even when this email doesn't advance the status, its
    // timestamp (e.g. an application email arriving after the record is already
    // rejected, during a backfill) must still be recorded on the record.
    //
    // `fromDrain` is what makes the pin binding: against a pinned record the
    // store degrades this write to detail enrichment only — no status, no
    // stamps, no eventAt, no milestones — while still round-tripping the rest.
    // `lift` removes the tombstone this action just earned the right to lift, in
    // the same save that re-creates the record.
    if (persistStatus) updateStatus(internship, persistStatus, { fromDrain: true, lift });
    // A pinned record's milestones are the owner's too — a drained interview
    // must not appear on a record whose status they set by hand.
    if (!_pinned && action.interview?.date) {
      addMilestone(internship.id, { id: `gmail-${action.gmailMessageId}`, kind: 'interview', date: action.interview.date, time: action.interview.time || null, title: `Interview — ${action.company}` });
    }
    return { id: internship.id, company: action.company, kind: shouldSetStatus ? action.kind : null };
  }, [updateStatus, addMilestone]);

  const drain = useCallback(async ({ backfillDays = 0 } = {}) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const status = await requestJson(`/api/integrations/gmail/status?profile=${encodeURIComponent(profile)}`).catch(() => null);
      if (!status?.connected) return;
      // A backfill re-scans older mail (ignoring the processed list) so existing
      // records get re-stamped with accurate applied/rejected dates.
      const syncUrl = `/api/integrations/gmail/sync-now?profile=${encodeURIComponent(profile)}${backfillDays > 0 ? `&backfill=${backfillDays}` : ''}`;
      await requestJson(syncUrl, { method: 'POST' }).catch(() => null);
      const { actions } = await requestJson(`/api/integrations/gmail/pending?profile=${encodeURIComponent(profile)}`).catch(() => ({ actions: [] }));
      if (!actions?.length) return;

      // Oldest-first so the latest email's status wins (application → then
      // rejection = rejected), sharing one session map for company convergence.
      const ordered = actions.toSorted((a, b) => new Date(a.receivedAt || 0) - new Date(b.receivedAt || 0));
      const session = new Map();
      const appliedIds = [];
      const appliedById = new Map();
      for (const action of ordered) {
        const result = applyAction(action, session);
        appliedIds.push(action.id); // ack even non-applicable ones so the queue drains
        if (result) appliedById.set(result.id, result);
      }
      if (appliedIds.length) {
        await requestJson(`/api/integrations/gmail/ack?profile=${encodeURIComponent(profile)}`, { method: 'POST', body: { ids: appliedIds } }).catch(() => null);
      }
      if (appliedById.size) setJustApplied([...appliedById.values()]);
    } finally {
      busy.current = false;
    }
  }, [profile, applyAction]);

  useEffect(() => {
    if (!profile) return undefined;
    // One-time backfill (per browser) so existing records are re-stamped with
    // accurate applied/rejected dates from their emails; normal polling after.
    const BACKFILL_FLAG = 'resume-studio:ts-backfill-v1';
    let needsBackfill = false;
    try { needsBackfill = !localStorage.getItem(BACKFILL_FLAG); } catch { /* ignore */ }
    const t = setTimeout(() => {
      if (needsBackfill) {
        drain({ backfillDays: 180 }).finally(() => { try { localStorage.setItem(BACKFILL_FLAG, '1'); } catch { /* ignore */ } });
      } else {
        drain();
      }
    }, 1500);
    const iv = setInterval(() => drain(), POLL_MS);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [profile, drain]);

  return { justApplied, clearJustApplied: () => setJustApplied([]) };
}
