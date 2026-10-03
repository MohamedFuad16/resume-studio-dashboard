// The job-type filter ("All / Internship / New grad / Full time") shared by the
// Dashboard, Applications and the sidebar badge, so switching it on one view
// switches them all. Same store shape as useActivityPeriod, persisted per browser.
import { useSyncExternalStore } from 'react';
import { JOB_TYPES, JOB_TYPE_UNKNOWN } from '../utils/jobType.js';

const LS_KEY = 'resume-studio:job-type-filter';
const VALUES = new Set(['all', ...JOB_TYPES, JOB_TYPE_UNKNOWN]);

function readStored() {
  try {
    const value = localStorage.getItem(LS_KEY);
    return VALUES.has(value) ? value : 'all';
  } catch {
    return 'all';
  }
}

let current = readStored();
const listeners = new Set();

export function setJobTypeFilter(next) {
  current = VALUES.has(next) ? next : 'all';
  try { localStorage.setItem(LS_KEY, current); } catch { /* private mode */ }
  listeners.forEach(fn => fn());
}

const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const snapshot = () => current;

export function useJobTypeFilter() {
  const jobType = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { jobType, setJobType: setJobTypeFilter };
}
