import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackerApi } from '../api/client.js';
import { isInternshipApplication } from '../utils/roleFilter.js';

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
const trackerCache = new Map();    // profileId -> normalized tracker
const trackerRequests = new Map(); // profileId -> in-flight promise

async function loadTracker(profileId, { force = false } = {}) {
  if (!force && trackerCache.has(profileId)) return trackerCache.get(profileId);
  if (!force && trackerRequests.has(profileId)) return trackerRequests.get(profileId);
  const request = trackerApi.get(profileId)
    .then(parsed => {
      const tracker = normalizeTracker(parsed);
      trackerCache.set(profileId, tracker);
      return tracker;
    })
    .finally(() => { trackerRequests.delete(profileId); });
  trackerRequests.set(profileId, request);
  return request;
}

export function useApplicationTracker(profileId) {
  const activeProfile = normalizeProfileId(profileId);
  const [tracker, setTracker] = useState(() => trackerCache.get(activeProfile) || EMPTY_TRACKER);
  const trackerRef = useRef(tracker);
  const [loading, setLoading] = useState(() => !trackerCache.has(activeProfile));
  const [error, setError] = useState('');

  const replaceTracker = useCallback(next => {
    trackerRef.current = next;
    setTracker(next);
  }, []);

  const refresh = useCallback(async ({ force = true } = {}) => {
    if (force || !trackerCache.has(activeProfile)) setLoading(true);
    try {
      setError('');
      replaceTracker(await loadTracker(activeProfile, { force }));
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
  const commitTimer = useRef(null);
  const commit = useCallback(next => {
    trackerCache.set(activeProfile, next);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null;
      trackerApi.save(activeProfile, next)
        .then(() => window.dispatchEvent(new CustomEvent(TRACKER_EVENT, { detail: { profileId: activeProfile, tracker: next } })))
        .catch(saveError => {
          setError(saveError.message || 'Could not save application tracker');
          refresh();
        });
    }, 150);
  }, [activeProfile, refresh]);

  useEffect(() => {
    const sync = event => {
      if (event.detail?.profileId === activeProfile) replaceTracker(normalizeTracker(event.detail.tracker));
    };
    window.addEventListener(TRACKER_EVENT, sync);
    return () => window.removeEventListener(TRACKER_EVENT, sync);
  }, [activeProfile, replaceTracker]);

  useEffect(() => {
    replaceTracker(trackerCache.get(activeProfile) || EMPTY_TRACKER);
    refresh({ force: false });
  }, [activeProfile, refresh, replaceTracker]);

  const updateStatus = useCallback((internship, status) => {
    const current = trackerRef.current;
    const next = { ...current };
    if (!status) {
      delete next[internship.id];
    } else {
      const prev = current[internship.id];
      // Per-status event timestamps (from the Gmail email date; see useGmailInbox).
      // Each is carried forward and only overwritten when a new value arrives.
      const appliedAt = internship.appliedAt ?? prev?.appliedAt ?? null;
      const rejectedAt = internship.rejectedAt ?? prev?.rejectedAt ?? null;
      const interviewAt = internship.interviewAt ?? prev?.interviewAt ?? null;
      const offerAt = internship.offerAt ?? prev?.offerAt ?? null;
      const now = new Date().toISOString();
      // updatedAt = this event's real date (Gmail) or now (in-app edit).
      const updatedAt = internship.eventAt || now;
      // createdAt = the EARLIEST known instant (first application, not the drain
      // time) so "when applied" is accurate. ISO strings sort chronologically.
      const createdAt = [prev?.createdAt, appliedAt, rejectedAt, interviewAt, offerAt, internship.eventAt]
        .filter(Boolean).sort()[0] || now;
      next[internship.id] = {
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
        updatedAt,
        createdAt,
        milestones: Array.isArray(prev?.milestones) ? prev.milestones : [],
      };
    }
    replaceTracker(next);
    commit(next);
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
  // `records` is the app's list of internship applications, so freelance/gig
  // records mis-ingested from Gmail (e.g. "language expert", "email analyst",
  // "AI trainer") are filtered out HERE — every consumer (dashboard recent +
  // pipeline, Applications view + its counts, calendar) then treats them as
  // non-existent. The raw `tracker` object still holds them (nothing is
  // deleted); `statusFor` reads `tracker` directly, so status writes for any id
  // still work. Filter is conservative (see roleFilter) — never hides a real
  // internship.
  const records = useMemo(
    () => Object.values(tracker)
      .filter(isInternshipApplication)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [tracker],
  );
  const counts = useMemo(() => APPLICATION_STATUSES.reduce((acc, item) => {
    acc[item.value] = records.filter(record => record.status === item.value).length;
    return acc;
  }, {}), [records]);

  return { tracker, records, counts, statusFor, updateStatus, addMilestone, removeMilestone, loading, error, refresh };
}
