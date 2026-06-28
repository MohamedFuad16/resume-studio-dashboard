import { useCallback, useEffect, useMemo, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || '';
export const TRACKER_KEY = 'resume-studio:application-tracker:v1';
export const TRACKER_EVENT = 'resume-studio:application-tracker-change';

export const APPLICATION_STATUSES = [
  { value: 'saved', label: 'Saved', labelJa: '保存済み' },
  { value: 'applying', label: 'Applying', labelJa: '応募準備中' },
  { value: 'applied', label: 'Applied', labelJa: '応募済み' },
  { value: 'interview', label: 'Interview', labelJa: '面接中' },
];

const STATUS_VALUES = new Set(APPLICATION_STATUSES.map(item => item.value));
const LEGACY_STATUS_MAP = { offer: 'applied', rejected: 'applied' };

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

function storageKey(profileId) {
  return `${TRACKER_KEY}:${normalizeProfileId(profileId)}`;
}

function normalizeTracker(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_TRACKER;
  return Object.fromEntries(Object.entries(parsed).map(([key, record]) => {
    const status = STATUS_VALUES.has(record?.status) ? record.status : (LEGACY_STATUS_MAP[record?.status] || 'saved');
    return [key, { ...record, status }];
  }));
}

function readTracker(profileId) {
  try {
    const profile = normalizeProfileId(profileId);
    const raw = localStorage.getItem(storageKey(profile)) || (profile === DEFAULT_PROFILE ? localStorage.getItem(TRACKER_KEY) : null) || '{}';
    return normalizeTracker(JSON.parse(raw));
  } catch {
    return EMPTY_TRACKER;
  }
}

export function statusLabel(status, isJa = false) {
  const item = APPLICATION_STATUSES.find(entry => entry.value === status);
  return item ? (isJa ? item.labelJa : item.label) : (isJa ? '未管理' : 'Track');
}

async function saveServerTracker(next, profileId) {
  const profile = normalizeProfileId(profileId);
  const response = await fetch(`${API}/api/tracker?profile=${encodeURIComponent(profile)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next),
  });
  if (!response.ok) throw new Error('Could not save application tracker');
}

function persistTracker(next, profileId, { syncServer = true } = {}) {
  const profile = normalizeProfileId(profileId);
  const serialized = JSON.stringify(next);
  localStorage.setItem(storageKey(profile), serialized);
  if (profile === DEFAULT_PROFILE) localStorage.setItem(TRACKER_KEY, serialized);
  window.dispatchEvent(new CustomEvent(TRACKER_EVENT, { detail: { profileId: profile, tracker: next } }));
  if (syncServer) saveServerTracker(next, profile).catch(() => {});
}

export function useApplicationTracker(profileId) {
  const activeProfile = normalizeProfileId(profileId);
  const [tracker, setTracker] = useState(() => readTracker(activeProfile));

  useEffect(() => {
    const sync = event => {
      if (event.type === TRACKER_EVENT && event.detail) {
        if (event.detail.profileId === activeProfile) setTracker(event.detail.tracker || EMPTY_TRACKER);
      } else {
        setTracker(readTracker(activeProfile));
      }
    };
    window.addEventListener('storage', sync);
    window.addEventListener(TRACKER_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(TRACKER_EVENT, sync);
    };
  }, [activeProfile]);

  useEffect(() => {
    let active = true;
    const localTracker = readTracker(activeProfile);
    setTracker(localTracker);
    fetch(`${API}/api/tracker?profile=${encodeURIComponent(activeProfile)}`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error('tracker fetch failed')))
      .then(remote => {
        if (!active) return;
        const serverTracker = normalizeTracker(remote);
        if (Object.keys(serverTracker).length) {
          setTracker(serverTracker);
          persistTracker(serverTracker, activeProfile, { syncServer: false });
        } else if (Object.keys(localTracker).length) {
          saveServerTracker(localTracker, activeProfile).catch(() => {});
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [activeProfile]);

  const updateStatus = useCallback((internship, status) => {
    setTracker(current => {
      const next = { ...current };
      if (!status) {
        delete next[internship.id];
      } else {
        next[internship.id] = {
          ...current[internship.id],
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
          updatedAt: new Date().toISOString(),
          createdAt: current[internship.id]?.createdAt || new Date().toISOString(),
          milestones: Array.isArray(current[internship.id]?.milestones) ? current[internship.id].milestones : [],
        };
      }
      try { persistTracker(next, activeProfile); } catch { /* Storage may be unavailable. */ }
      return next;
    });
  }, [activeProfile]);

  const statusFor = useCallback(id => tracker[id]?.status || '', [tracker]);
  const addMilestone = useCallback((internshipId, milestone) => {
    setTracker(current => {
      const record = current[internshipId];
      if (!record || !/^\d{4}-\d{2}-\d{2}$/.test(milestone?.date || '')) return current;
      const next = {
        ...current,
        [internshipId]: {
          ...record,
          milestones: [
            ...(Array.isArray(record.milestones) ? record.milestones : []),
            {
              id: milestone.id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
              kind: milestone.kind || 'other',
              date: milestone.date,
              time: milestone.time || null,
              timeZone: 'Asia/Tokyo',
              title: milestone.title || '',
              createdAt: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        },
      };
      try { persistTracker(next, activeProfile); } catch { /* Storage may be unavailable. */ }
      return next;
    });
  }, [activeProfile]);

  const removeMilestone = useCallback((internshipId, milestoneId) => {
    setTracker(current => {
      const record = current[internshipId];
      if (!record) return current;
      const next = {
        ...current,
        [internshipId]: {
          ...record,
          milestones: (record.milestones || []).filter(item => item.id !== milestoneId),
          updatedAt: new Date().toISOString(),
        },
      };
      try { persistTracker(next, activeProfile); } catch { /* Storage may be unavailable. */ }
      return next;
    });
  }, [activeProfile]);
  const records = useMemo(
    () => Object.values(tracker).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [tracker],
  );
  const counts = useMemo(() => APPLICATION_STATUSES.reduce((acc, item) => {
    acc[item.value] = records.filter(record => record.status === item.value).length;
    return acc;
  }, {}), [records]);

  return { tracker, records, counts, statusFor, updateStatus, addMilestone, removeMilestone };
}
