import { useCallback, useEffect, useRef, useState } from 'react';
import { requestJson } from '../api/client.js';
import { useApplicationTracker } from './useApplicationTracker.js';
import { useInternshipCatalog } from './useInternshipCatalog.js';

const POLL_MS = 90000;
const KIND_TO_STATUS = { applied: 'applied', rejected: 'rejected', interview: 'interview', offer: 'applied' };
// Status precedence within one drain: a terminal outcome (rejected) must not be
// overwritten by an earlier application/interview email for the same company.
const STATUS_RANK = { saved: 0, applied: 1, interview: 2, rejected: 3 };
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

  const applyAction = useCallback((action, session) => {
    const status = KIND_TO_STATUS[action.kind];
    const companyNeedle = norm(action.company);
    if (!status || !companyNeedle) return null;

    // One record per company. Reuse a base resolved earlier in THIS drain, else
    // an existing tracked record, else a catalog listing, else a synthetic entry
    // keyed by company — so applied+rejected for the same company converge.
    let base = session.get(companyNeedle);
    if (!base) {
      const existing = recordsRef.current.find(r => norm(r.company).includes(companyNeedle) || companyNeedle.includes(norm(r.company)));
      const catItem = existing ? null : catalogRef.current.find(i => norm(i.company).includes(companyNeedle) || companyNeedle.includes(norm(i.company)));
      base = existing
        ? { id: existing.internshipId, company: existing.company, role: existing.role, location: existing.location, deadline: existing.deadline, deadlineDate: existing.deadlineDate, url: existing.applyUrl, companyDomain: existing.companyDomain, logoUrl: existing.logoUrl }
        : catItem
          ? { id: catItem.id, company: catItem.company, role: catItem.role, location: catItem.location, deadline: catItem.deadline, deadlineDate: catItem.deadlineDate, url: catItem.url, companyDomain: catItem.companyDomain, logoUrl: catItem.logoUrl }
          : { id: `gmail-${slug(action.company)}`, company: action.company, role: action.role || 'Application', location: action.enrichment?.location || '', deadline: action.enrichment?.deadline || 'Not stated', deadlineDate: action.enrichment?.deadlineDate || null, url: action.enrichment?.url || '' };
      session.set(companyNeedle, base);
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
    if (shouldSetStatus) base._rank = rank;
    const { _rank, ...cleanBase } = base;
    const internship = { ...cleanBase, source: 'gmail', sourceMeta: { gmailMessageId: action.gmailMessageId, receivedAt: action.receivedAt, subject: action.subject } };
    if (shouldSetStatus) updateStatus(internship, status);
    if (action.interview?.date) {
      addMilestone(internship.id, { id: `gmail-${action.gmailMessageId}`, kind: 'interview', date: action.interview.date, time: action.interview.time || null, title: `Interview — ${action.company}` });
    }
    return { id: internship.id, company: action.company, kind: shouldSetStatus ? action.kind : null };
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

      // Oldest-first so the latest email's status wins (application → then
      // rejection = rejected), sharing one session map for company convergence.
      const ordered = [...actions].sort((a, b) => new Date(a.receivedAt || 0) - new Date(b.receivedAt || 0));
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
    const t = setTimeout(drain, 1500);
    const iv = setInterval(drain, POLL_MS);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [profile, drain]);

  return { justApplied, clearJustApplied: () => setJustApplied([]) };
}
