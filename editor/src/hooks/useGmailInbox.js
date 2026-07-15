import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJson } from '../api/client.js';
import { useApplicationTracker } from './useApplicationTracker.js';
import { useInternshipCatalog } from './useInternshipCatalog.js';

const POLL_MS = 90000;
const KIND_TO_STATUS = { applied: 'applied', rejected: 'rejected', interview: 'interview', offer: 'applied' };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
  recordsRef.current = records;
  catalogRef.current = catalog;

  const applyAction = useCallback((action) => {
    const status = KIND_TO_STATUS[action.kind];
    if (!status) return null;
    const companyNeedle = norm(action.company);
    if (!companyNeedle) return null;

    // Match an existing tracked record, else a catalog listing, else synthesize.
    const existing = recordsRef.current.find(r => norm(r.company).includes(companyNeedle) || companyNeedle.includes(norm(r.company)));
    const catItem = existing ? null : catalogRef.current.find(i => norm(i.company).includes(companyNeedle) || companyNeedle.includes(norm(i.company)));

    const base = existing
      ? { id: existing.internshipId, company: existing.company, role: existing.role, location: existing.location, deadline: existing.deadline, deadlineDate: existing.deadlineDate, url: existing.applyUrl, companyDomain: existing.companyDomain, logoUrl: existing.logoUrl }
      : catItem
        ? { id: catItem.id, company: catItem.company, role: catItem.role, location: catItem.location, deadline: catItem.deadline, deadlineDate: catItem.deadlineDate, url: catItem.url, companyDomain: catItem.companyDomain, logoUrl: catItem.logoUrl }
        : { id: `gmail-${slug(action.company)}-${slug(action.role) || 'role'}`, company: action.company, role: action.role || 'Application', location: action.enrichment?.location || '', deadline: action.enrichment?.deadline || 'Not stated', deadlineDate: action.enrichment?.deadlineDate || null, url: action.enrichment?.url || '' };

    const internship = { ...base, source: 'gmail', sourceMeta: { gmailMessageId: action.gmailMessageId, receivedAt: action.receivedAt, subject: action.subject } };
    updateStatus(internship, status);
    if (action.interview?.date) {
      addMilestone(internship.id, { kind: 'interview', date: action.interview.date, time: action.interview.time || null, title: `Interview — ${action.company}` });
    }
    return { id: internship.id, company: action.company, role: internship.role, kind: action.kind };
  }, [updateStatus, addMilestone]);

  const drain = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const status = await requestJson(`/api/integrations/gmail/status?profile=${encodeURIComponent(profile)}`).catch(() => null);
      if (!status?.connected) return;
      await requestJson(`/api/integrations/gmail/sync-now?profile=${encodeURIComponent(profile)}`, { method: 'POST' }).catch(() => null);
      const { actions } = await requestJson(`/api/integrations/gmail/pending?profile=${encodeURIComponent(profile)}`).catch(() => ({ actions: [] }));
      if (!actions?.length) return;

      const appliedIds = [];
      const applied = [];
      for (const action of actions) {
        const result = applyAction(action);
        appliedIds.push(action.id); // ack even non-applicable ones so the queue drains
        if (result) applied.push(result);
      }
      if (appliedIds.length) {
        await requestJson(`/api/integrations/gmail/ack?profile=${encodeURIComponent(profile)}`, { method: 'POST', body: { ids: appliedIds } }).catch(() => null);
      }
      if (applied.length) setJustApplied(applied);
    } finally {
      busy.current = false;
    }
  }, [profile, applyAction]);

  useEffect(() => {
    if (!profile) return undefined;
    const t = setTimeout(drain, 1500);
    const iv = setInterval(drain, POLL_MS);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [profile, drain]);

  return { justApplied, clearJustApplied: () => setJustApplied([]) };
}
