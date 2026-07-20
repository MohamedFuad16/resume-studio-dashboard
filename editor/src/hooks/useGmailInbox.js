import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJson } from '../api/client.js';
import { useApplicationTracker } from './useApplicationTracker.js';
import { useInternshipCatalog } from './useInternshipCatalog.js';
import {
  addMonths, normalizeCompany, roleKey, gmailRecordId, sessionKeyFor, GENERAL_ROLE,
} from '../utils/reapplyCooldown.js';

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
const byId = (items, idOf) => [...(items || [])].sort((a, b) => compareIds(String(idOf(a)), String(idOf(b))));

// Most recently updated candidate; on an equal `updatedAt` the LOWEST record id
// wins. The tie-break lives in the comparator rather than relying on sort
// stability — neither Swift's sort nor every JS engine documents it (§4, and the
// 2026-07-20 parity bulletin).
const mostRecent = candidates =>
  candidates.reduce((best, c) => {
    if (!best) return c;
    const at = String(c.updatedAt || '');
    const bt = String(best.updatedAt || '');
    if (at !== bt) return at > bt ? c : best;
    return compareIds(String(c.base.id), String(best.base.id)) < 0 ? c : best;
  }, null);

// A tracker record → the internship base the drain mutates. `_rank`/`_status`
// carry the record's current status so it is never downgraded, `_updatedAt` is
// what §3 orders candidates by.
const baseFromRecord = record => ({
  id: record.internshipId,
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
});

/**
 * §3 — resolve an action that names NO role onto one of the company's existing
 * records. Rejection mail routinely omits the role ("we will not be moving
 * forward"), and creating a `<company>-general` row for it would sit a phantom
 * beside the real application.
 *
 * Candidates = every record for this company, whether created earlier in THIS
 * drain (session) or already in the tracker; the session wins on id collision
 * because it holds the fresher status. Sorted by id, so ties resolve identically
 * on every run.
 *
 *   1. exactly one record  → that one
 *   2. several             → the most recently updated NON-terminal one
 *   3. all terminal        → the most recently updated one
 *   4. none                → null (the caller creates `<company>-general`)
 */
function resolveRolelessTarget(companyKey, session, records) {
  const prefix = `${companyKey}|`;
  const seen = new Map(); // record id -> { key, base, status, updatedAt }
  for (const [sessionKey, base] of session) {
    if (!sessionKey.startsWith(prefix)) continue;
    seen.set(base.id, { key: sessionKey, base, status: base._status, updatedAt: base._updatedAt || '' });
  }
  for (const record of records || []) {
    if (norm(record.company) !== companyKey) continue;
    if (seen.has(record.internshipId)) continue; // the session copy is fresher
    seen.set(record.internshipId, {
      key: sessionKeyFor(companyKey, roleKey(record.role)),
      base: baseFromRecord(record),
      status: record.status,
      updatedAt: record.updatedAt || '',
    });
  }
  const candidates = byId([...seen.values()], c => c.base.id);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const inFlight = candidates.filter(c => !TERMINAL_STATUSES.has(c.status));
  return mostRecent(inFlight.length ? inFlight : candidates);
}

// Drains the server-side Gmail action queue into the Firestore-backed tracker /
// calendar. Runs full-auto: on load and on an interval while the tab is open, it
// syncs the inbox, applies each action, and acks it. Mount ONCE (in App).
export function useGmailInbox(profile) {
  const { records, updateStatus, addMilestone } = useApplicationTracker(profile);
  const { catalog } = useInternshipCatalog();
  const [justApplied, setJustApplied] = useState([]);
  const recordsRef = useRef(records);
  const catalogRef = useRef(catalog);
  const busy = useRef(false);
  // Keep the latest values for the async drain without retriggering it. Written
  // in an effect (not during render): React may replay/discard render work, and
  // the drain only reads these after commit anyway.
  useEffect(() => { recordsRef.current = records; }, [records]);
  useEffect(() => { catalogRef.current = catalog; }, [catalog]);

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
      const target = resolveRolelessTarget(companyNeedle, session, recordsRef.current);
      // Bind the resolved record under ITS OWN (company, role) key, so a second
      // role-less email in the same drain lands on the same record.
      if (target) { key = target.key; base = target.base; session.set(key, base); }
    }
    if (!base) {
      // §4 — EXACT companyKey equality, never a substring test (substrings merge
      // genuinely different companies whose keys nest), over a collection sorted
      // by id so repeated runs over the same data resolve identically.
      const existing = byId(recordsRef.current, r => r.internshipId)
        .find(r => norm(r.company) === companyNeedle && roleKey(r.role) === actionRole);
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
      base = existing
        ? baseFromRecord(existing)
        : catItem
          ? { id: catItem.id, company: catItem.company, role: catItem.role, location: catItem.location, deadline: catItem.deadline, deadlineDate: catItem.deadlineDate, url: catItem.url, companyDomain: catItem.companyDomain, logoUrl: catItem.logoUrl }
          : { id: gmailRecordId(action.company, action.role), company: action.company, role: action.role || 'Application', location: action.enrichment?.location || '', deadline: action.enrichment?.deadline || 'Not stated', deadlineDate: action.enrichment?.deadlineDate || null, url: action.enrichment?.url || '' };
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
    const rank = STATUS_RANK[status] ?? 0;
    const shouldSetStatus = base._rank == null || rank >= base._rank;
    if (shouldSetStatus) { base._rank = rank; base._status = status; }
    const persistStatus = base._status || status;
    // The real email date for this event → per-status timestamp, so "when
    // applied / rejected / interviewed" reflects the email, not the drain time.
    // eventAt drives the record's updatedAt/createdAt in updateStatus.
    const eventAt = (() => { const d = new Date(action.receivedAt); return Number.isNaN(d.getTime()) ? null : d.toISOString(); })();
    // Keep the session copy's updatedAt in step with what updateStatus will
    // persist, so a role-less action later in this drain orders candidates on
    // the same values §3 would read back from the tracker.
    if (eventAt && eventAt > String(base._updatedAt || '')) base._updatedAt = eventAt;
    const { _rank, _status, _updatedAt, ...cleanBase } = base;
    const stampKey = { applied: 'appliedAt', rejected: 'rejectedAt', interview: 'interviewAt', offer: 'offerAt' }[action.kind];
    const internship = { ...cleanBase, source: 'gmail', sourceMeta: { gmailMessageId: action.gmailMessageId, receivedAt: action.receivedAt, subject: action.subject } };
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
    if (persistStatus) updateStatus(internship, persistStatus);
    if (action.interview?.date) {
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
