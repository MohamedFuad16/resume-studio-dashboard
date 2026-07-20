import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bookmark, CalendarClock, CircleSlash, FilePenLine, Inbox, Pin, Send } from 'lucide-react';
import { APPLICATION_STATUSES, statusLabel, useApplicationTracker } from '../hooks/useApplicationTracker.js';
import { useInternshipCatalog } from '../hooks/useInternshipCatalog.js';
import { CompanyLogo } from './CompanyLogo.jsx';
import GmailMark from './GmailMark.jsx';
import { DetailPanel } from './InternshipDashboard.jsx';
import InterviewDateModal from './InterviewDateModal.jsx';
import { displayCompany, displayRole, displayValue, formatDisplayDeadline } from '../utils/internshipDisplay.js';
import { companyCooldownMap, cooldownForCompany, cooldownLabel } from '../utils/reapplyCooldown.js';

const STATUS_ICONS = {
  saved: Bookmark,
  applying: FilePenLine,
  applied: Send,
  interview: CalendarClock,
  rejected: CircleSlash,
};

const copy = {
  en: {
    title: 'Applications',
    subtitle: 'Every company you have saved, applied to, or heard back from — in one place.',
    all: 'All',
    companyRole: 'Company & role',
    location: 'Location',
    deadline: 'Deadline',
    status: 'Status',
    open: 'Open',
    notApplied: 'Not applied',
    empty: 'No applications yet',
    emptySub: 'Track a role from Internship Radar and it will show up here.',
    explore: 'Browse internships',
    countLabel: n => `${n} ${n === 1 ? 'application' : 'applications'}`,
  },
  ja: {
    title: '応募一覧',
    subtitle: '保存・応募・結果待ちのすべての企業をまとめて確認できます。',
    all: 'すべて',
    companyRole: '企業・職種',
    location: '場所',
    deadline: '締切',
    status: '状況',
    open: '開く',
    notApplied: '未応募',
    empty: 'まだ応募はありません',
    emptySub: 'インターン検索から応募を管理するとここに表示されます。',
    explore: 'インターンを見る',
    countLabel: n => `${n}件の応募`,
  },
};

export default function ApplicationsView({ isJa, activeProfile, onOpenRadar, onOpenEditor }) {
  const t = isJa ? copy.ja : copy.en;
  const { records, counts, statusFor, updateStatus, addMilestone } = useApplicationTracker(activeProfile);
  const { catalog } = useInternshipCatalog();
  const [filter, setFilter] = useState('all');
  const [interviewPending, setInterviewPending] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const cooldownMap = useMemo(() => companyCooldownMap(records), [records]);

  const visible = useMemo(
    () => (filter === 'all' ? records : records.filter(record => record.status === filter)),
    [records, filter],
  );

  // Picking a status here is the owner overruling the pipeline, so the write is
  // PINNED: no Gmail drain may move that status again (ADR-S-004). Choosing
  // "Not applied" deletes the record and tombstones its (company, role) pair, so
  // a re-derive cannot resurrect it either.
  const onStatusChange = (item, value) => {
    if (value === 'interview') { setInterviewPending(item); return; }
    updateStatus(item, value, { pin: true });
  };
  const onInterviewConfirm = value => {
    const item = interviewPending;
    if (!item) return;
    const [date, time = ''] = String(value || '').trim().split(/[ T]/);
    updateStatus(item, 'interview', { pin: true });
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) addMilestone(item.id, { kind: 'interview', date, time: time || null });
    setInterviewPending(null);
  };
  const onApply = item => {
    const current = statusFor(item.id);
    if (!current || current === 'saved') updateStatus(item, 'applying');
  };

  useEffect(() => {
    if (!selectedItem) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setSelectedItem(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedItem]);

  const tabs = [{ value: 'all', label: t.all, count: records.length }, ...APPLICATION_STATUSES.map(s => ({ value: s.value, label: statusLabel(s.value, isJa), count: counts[s.value] || 0 }))];

  return (
    <main className="applications-view">
      <div className="section-heading applications-head">
        <div><h2>{t.title}</h2><p>{t.subtitle}</p></div>
        <span className="applications-count">{t.countLabel(records.length)}</span>
      </div>

      <div className="applications-tabs" role="tablist" aria-label={t.title}>
        {tabs.map(tab => {
          const Icon = STATUS_ICONS[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={filter === tab.value}
              className={`applications-tab ${filter === tab.value ? 'active' : ''} ${tab.value}`}
              onClick={() => setFilter(tab.value)}
            >
              {Icon ? <Icon size={14} /> : null}
              <span>{tab.label}</span>
              <b>{tab.count}</b>
            </button>
          );
        })}
      </div>

      <div className="application-list">
        <div className="application-list-head">
          <span>{t.companyRole}</span><span>{t.location}</span><span>{t.deadline}</span><span>{t.status}</span><span>{t.open}</span>
        </div>
        {visible.length ? visible.map(record => {
          const item = catalog.find(entry => entry.id === record.internshipId)
            || { ...record, id: record.internshipId, url: record.applyUrl };
          const cooldown = cooldownForCompany(cooldownMap, record.company);
          return (
            <article className="application-row" key={record.internshipId}>
              <span className="application-company"><CompanyLogo item={item} /><button type="button" className="application-company-trigger" onClick={() => setSelectedItem(item)} aria-label={isJa ? `${displayCompany(item, isJa)}の詳細を開く` : `Open details for ${displayCompany(item, isJa)}`}><b>{displayCompany(item, isJa)}{record.source === 'gmail' && <span className="src-gmail" title={isJa ? 'Gmailから追加' : 'Added from Gmail'}><GmailMark size={12} /></span>}{record.statusPinned && <span className="src-pinned" title={isJa ? '手動で設定した状況 — Gmailの同期で変更されません' : 'Status set by you — Gmail sync will not change it'}><Pin size={12} /></span>}</b><small>{displayRole(item.role || record.role, isJa)}{cooldown ? <span className="application-cooldown-tag"><CalendarClock size={11} />{cooldownLabel(cooldown, isJa)}</span> : null}</small></button></span>
              <span>{displayValue(record.location, isJa)}</span>
              <span className="application-deadline">{formatDisplayDeadline(record.deadline, isJa)}</span>
              <select value={record.status} onChange={event => onStatusChange(item, event.target.value)} aria-label={isJa ? `${record.company}の応募状況` : `Status for ${record.company}`}>
                {APPLICATION_STATUSES.map(status => <option value={status.value} key={status.value}>{statusLabel(status.value, isJa)}</option>)}
                <option value="">{t.notApplied}</option>
              </select>
              {record.applyUrl ? <a href={record.applyUrl} target="_blank" rel="noreferrer">{t.open} <ArrowRight size={14} /></a> : <span className="application-nolink">—</span>}
            </article>
          );
        }) : (
          <div className="application-empty"><span className="application-empty-icon" aria-hidden="true"><Inbox size={20} /></span><b>{t.empty}</b><span>{t.emptySub}</span><button type="button" onClick={onOpenRadar}>{t.explore}</button></div>
        )}
      </div>

      {selectedItem ? (
        <div className="intern-detail-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
          <DetailPanel
            item={selectedItem}
            status={statusFor(selectedItem.id) || ''}
            onStatus={onStatusChange}
            onApply={onApply}
            onClose={() => setSelectedItem(null)}
            onOpenEditor={onOpenEditor}
            cooldown={cooldownForCompany(cooldownMap, selectedItem.company)}
            isJa={isJa}
          />
        </div>
      ) : null}

      <InterviewDateModal
        open={Boolean(interviewPending)}
        applicationLabel={interviewPending ? `${displayCompany(interviewPending, isJa)} — ${displayRole(interviewPending.role, isJa)}` : ''}
        initialDate=""
        isJa={isJa}
        onConfirm={onInterviewConfirm}
        onCancel={() => setInterviewPending(null)}
      />
    </main>
  );
}
