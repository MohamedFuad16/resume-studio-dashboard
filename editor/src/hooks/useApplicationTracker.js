import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackerApi } from '../api/client.js';
import {
  addTombstone, nextTrackerRecord, normalizeTombstones, removeTombstone, tombstoneKeysFor,
} from '../utils/trackerTruth.js';

export const TRACKER_EVENT = 'resume-studio:application-tracker-change';

export const APPLICATION_STATUSES = [
  { value: 'saved', label: 'Saved', labelJa: '保存済み' },
  { value: 'applying', label: 'Applying', labelJa: '応募準備中' },
  { value: 'applied', label: 'Applied', labelJa: '応募済み' },
  { value: 'interview', label: 'Interview', labelJa: '面接中' },
  { value: 'rejected', label: 'Rejected', labelJa: '不合格' },
];

const STATUS_VALUES = new Set(APPLICATION_STATUSES.map(item => item.value));
// 'rejected' is a real status again — it used to be collapsed into 'applied',
// which destroyed the applied-vs-rejected signal. Records downgraded while that
// mapping was live already read 'applied' and cannot be recovered; only 'offer'
// still maps, as there is no offer status.
const LEGACY_STATUS_MAP = { offer: 'applied' };

const EMPTY_TRACKER = {};
const EMPTY_TOMBSTONES = [];
const DEFAULT_PROFILE = 'mohamed_fuad';

function normalizeProfileId(profileId) {
  if (profileId) return String(profileId).replace(/[^a-zA-Z0-9_-]/g, '') || DEFAULT_PROFILE;
  try {
    return new URLSearchParams(window.location.search).get('profile') || DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

function normalizeTracker(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_TRACKER;
  return Object.fromEntries(Object.entries(parsed).map(([key, record]) => {
    const status = STATUS_VALUES.has(record?.status) ? record.status : (LEGACY_STATUS_MAP[record?.status] || 'saved');
    return [key, { ...record, status }];
  }));
}

export function statusLabel(status, isJa = false) {
  const item = APPLICATION_STATUSES.find(entry => entry.value === status);
  return item ? (isJa ? item.labelJa : item.label) : (isJa ? '未管理' : 'Track');
}

// Module-level per-profile cache + in-flight dedupe (same pattern as
// useInternshipCatalog). The hook is mounted by several views at once (App shell,
// dashboard, applications view, radar, Gmail drain), and each mount used to issue
// its own GET /api/tracker on load. Mutations keep the cache fresh via commit();
// cross-mount state sync stays on TRACKER_EVENT.
// The cached value is the whole tracker DOCUMENT — `{ tracker, tombstones }` —
// because both live in one Firestore document and are written in one set (the
// whole-map, single-write discipline in contracts/tracker-record.md).
const trackerCache = new Map();    // profileId -> { tracker, tombstones }
const trackerRequests = new Map(); // profileId -> in-flight promise

async function loadTracker(profileId, { force = false } = {}) {
  if (!force && trackerCache.has(profileId)) return trackerCache.get(profileId);
  if (!force && trackerRequests.has(profileId)) return trackerRequests.get(profileId);
  const request = trackerApi.get(profileId)
    .then(parsed => {
      const loaded = {
        tracker: normalizeTracker(parsed?.data),
        tombstones: normalizeTombstones(parsed?.tombstones),
      };
      trackerCache.set(profileId, loaded);
      return loaded;
    })
    .finally(() => { trackerRequests.delete(profileId); });
  trackerRequests.set(profileId, request);
  return request;
}

export function useApplicationTracker(profileId) {
  const activeProfile = normalizeProfileId(profileId);
  const cached = trackerCache.get(activeProfile);
  const [tracker, setTracker] = useState(() => cached?.tracker || EMPTY_TRACKER);
  // Deleted (companyKey, roleKey) pairs — the Gmail drain must never re-create
  // one (contracts/tracker-record.md "Tombstones" · ADR-S-004).
  const [tombstones, setTombstones] = useState(() => cached?.tombstones || EMPTY_TOMBSTONES);
  const trackerRef = useRef(tracker);
  const tombstonesRef = useRef(tombstones);
  const [loading, setLoading] = useState(() => !trackerCache.has(activeProfile));
  const [error, setError] = useState('');

  const replaceTracker = useCallback((next, nextTombstones) => {
    trackerRef.current = next;
    setTracker(next);
    if (nextTombstones) {
      tombstonesRef.current = nextTombstones;
      setTombstones(nextTombstones);
    }
  }, []);

  const refresh = useCallback(async ({ force = true } = {}) => {
    if (force || !trackerCache.has(activeProfile)) setLoading(true);
    try {
      setError('');
      const loaded = await loadTracker(activeProfile, { force });
      replaceTracker(loaded.tracker, loaded.tombstones);
    } catch (fetchError) {
      setError(fetchError.message || 'Could not load application tracker');
    } finally {
      setLoading(false);
    }
  }, [activeProfile, replaceTracker]);

  // Trailing-debounced save. A Gmail drain applies many actions back-to-back and
  // each updateStatus() used to POST the FULL tracker — 10 actions = 10 identical
  // growing snapshots (and 10 Firestore writes in prod). Every commit carries the
  // complete tracker, so collapsing the burst to its LAST snapshot is lossless.
  // The local cache + trackerRef update synchronously, so reads stay fresh; the
  // timer deliberately survives unmount so a pending save is never dropped.
  //
  // The tombstone list rides along in the SAME save: it lives beside the tracker
  // map in one document, and a deletion that persisted the record removal but
  // not its tombstone would be re-created by the next drain.
  const commitTimer = useRef(null);
  const commit = useCallback((next, nextTombstones = tombstonesRef.current) => {
    trackerCache.set(activeProfile, { tracker: next, tombstones: nextTombstones });
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null;
      trackerApi.save(activeProfile, next, nextTombstones)
        .then(() => window.dispatchEvent(new CustomEvent(TRACKER_EVENT, { detail: { profileId: activeProfile, tracker: next, tombstones: nextTombstones } })))
        .catch(saveError => {
          setError(saveError.message || 'Could not save application tracker');
          refresh();
        });
    }, 150);
  }, [activeProfile, refresh]);

  useEffect(() => {
    const sync = event => {
      if (event.detail?.profileId !== activeProfile) return;
      replaceTracker(normalizeTracker(event.detail.tracker), normalizeTombstones(event.detail.tombstones));
    };
    window.addEventListener(TRACKER_EVENT, sync);
    return () => window.removeEventListener(TRACKER_EVENT, sync);
  }, [activeProfile, replaceTracker]);

  useEffect(() => {
    const entry = trackerCache.get(activeProfile);
    replaceTracker(entry?.tracker || EMPTY_TRACKER, entry?.tombstones || EMPTY_TOMBSTONES);
    refresh({ force: false });
  }, [activeProfile, refresh, replaceTracker]);

  /**
   * Write a record's status, or DELETE it when `status` is falsy.
   *
   * `options.pin` — the USER chose this status by hand: the record is pinned and
   *   a Gmail drain may never move its status again (ADR-S-004). Every in-app
   *   status control passes it; the drain never does.
   * `options.fromDrain` — this write comes from the Gmail drain. Against a
   *   pinned record it degrades to detail enrichment only; the pin is enforced
   *   inside `nextTrackerRecord`, so no caller can forget it.
   * `options.lift` — `{ companyKey, roleKey }`: the drain established that the
   *   owner RE-APPLIED to a tombstoned pair, so the tombstone is removed in the
   *   same write that re-creates the record. The KEYS come from the caller, not
   *   from the record: a role-less email writes `role: 'Application'` onto a
   *   record whose tombstone is keyed `general`, and re-deriving them here would
   *   leave the tombstone in place to block the row again on the next drain.
   *
   * A deletion writes a `{companyKey, roleKey, at}` tombstone, which is what
   * stops the next drain re-creating the row the owner just removed.
   */
  const updateStatus = useCallback((internship, status, options = {}) => {
    const current = trackerRef.current;
    const next = { ...current };
    let nextTombstones = tombstonesRef.current;
    if (!status) {
      const removed = current[internship.id];
      const { companyKey, roleKey } = tombstoneKeysFor(removed || internship);
      // An un-keyable company (nothing survives normalization) cannot be
      // tombstoned — `addTombstone` drops it rather than writing an entry that
      // would match every other un-keyable record.
      nextTombstones = addTombstone(nextTombstones, companyKey, roleKey, new Date().toISOString());
      delete next[internship.id];
    } else {
      if (options.lift) {
        nextTombstones = removeTombstone(nextTombstones, options.lift.companyKey, options.lift.roleKey);
      }
      next[internship.id] = nextTrackerRecord(current[internship.id], internship, status, options);
    }
    replaceTracker(next, nextTombstones);
    commit(next, nextTombstones);
  }, [commit, replaceTracker]);

  const statusFor = useCallback(id => tracker[id]?.status || '', [tracker]);
  // Contract: addMilestone(internship, { kind, date, time?, note? }).
  // `internship` may be the internship/record object or a bare id string, so both the
  // calendar (passes record.internshipId) and the radar/recent-apps status flows (pass
  // the internship object) work. `note` is accepted as an alias for `title`.
  const addMilestone = useCallback((internship, milestone) => {
    const internshipId = internship && typeof internship === 'object'
      ? (internship.internshipId || internship.id)
      : internship;
    const current = trackerRef.current;
    const record = current[internshipId];
    if (!record || !/^\d{4}-\d{2}-\d{2}$/.test(milestone?.date || '')) return;
    // A caller-supplied id is a dedupe key (Gmail derives it from the message id),
    // so re-draining the same email never duplicates a calendar milestone. Identical
    // kind+date+time+title also skips, covering milestones created before ids were stable.
    const existing = Array.isArray(record.milestones) ? record.milestones : [];
    if (milestone.id && existing.some(m => m?.id === milestone.id)) return;
    if (existing.some(m => m?.kind === (milestone.kind || 'other') && m?.date === milestone.date
      && (m?.time || null) === (milestone.time || null) && (m?.title || '') === (milestone.title || milestone.note || ''))) return;
    const next = {
      ...current,
      [internshipId]: {
        ...record,
        milestones: [...(Array.isArray(record.milestones) ? record.milestones : []), {
          id: milestone.id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          kind: milestone.kind || 'other', date: milestone.date, time: milestone.time || null,
          timeZone: 'Asia/Tokyo', title: milestone.title || milestone.note || '', createdAt: new Date().toISOString(),
        }],
        updatedAt: new Date().toISOString(),
      },
    };
    replaceTracker(next);
    commit(next);
  }, [commit, replaceTracker]);

  const removeMilestone = useCallback((internshipId, milestoneId) => {
    const current = trackerRef.current;
    const record = current[internshipId];
    if (!record) return;
    const next = {
      ...current,
      [internshipId]: {
        ...record,
        milestones: (record.milestones || []).filter(item => item.id !== milestoneId),
        updatedAt: new Date().toISOString(),
      },
    };
    replaceTracker(next);
    commit(next);
  }, [commit, replaceTracker]);
  // `records` is every tracker record, in updated-at order. Nothing is hidden
  // client-side: per ADR-S-002 internship detection is server-side and
  // evidence-based, so junk in the list means fixing the classifier
  // (`editor/server/gmail/classify.js`), not filtering names downstream.
  const records = useMemo(
    () => Object.values(tracker)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [tracker],
  );
  const counts = useMemo(() => APPLICATION_STATUSES.reduce((acc, item) => {
    acc[item.value] = records.filter(record => record.status === item.value).length;
    return acc;
  }, {}), [records]);

  return { tracker, tombstones, records, counts, statusFor, updateStatus, addMilestone, removeMilestone, loading, error, refresh };
}
