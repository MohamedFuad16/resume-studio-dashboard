// Company page (rebuild U2): everything about one company in one view. The
// overview, why it fits the owner, the selection steps in order with the owner's
// progress, the next step one click from the calendar, every role at the
// company, and the actions that matter before applying.
//
// Real data first: catalog listings carry the posting's own selection process,
// about text, fit reasons and facts. A company known only from the owner's
// applications gets what companyApi returns; until phase 2 that is a flow
// labelled "typical", never presented as the company's own.
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarClock, CalendarPlus, Check, ExternalLink, FileText, Mail, MapPin,
  PenLine, ShieldCheck, Sparkles, Trash2, X,
} from 'lucide-react';
import { APPLICATION_STATUSES, statusLabel, useApplicationTracker } from '../hooks/useApplicationTracker.js';
import { useInternshipCatalog } from '../hooks/useInternshipCatalog.js';
import { CompanyLogo } from './CompanyLogo.jsx';
import InterviewDateModal from './InterviewDateModal.jsx';
import { fitNoteDisplay, formatDeadline, reasonDisplay, splitRole } from './InternshipDashboard.jsx';
import { displayCompany, displayRole, displayValue, internshipDetails } from '../utils/internshipDisplay.js';
import { companyCooldownMap, cooldownForCompany, cooldownLabel } from '../utils/reapplyCooldown.js';
import { sameCompany } from '../utils/companyGroup.js';
import { inferJobType, jobTypeLabel } from '../utils/jobType.js';
import { resolveTechIcon } from '../utils/techIcons.js';
import { companyApi, isSampleData } from '../api/v2/index.js';
import { useAppActions } from '../context/AppActions.js';

const COPY = {
  en: {
    back: 'Back',
    match: 'match',
    createResume: 'Create a résumé for this role',
    coverLetter: 'Cover letter',
    apply: 'Apply on company site',
    about: 'About',
    noResearch: 'No company research yet. The research agent fills this in once it is connected.',
    fit: 'Why it fits you',
    fitPending: 'The research agent compares this company with your profile once it is connected.',
    steps: 'Selection process',
    fromPosting: 'From the posting',
    typical: 'Typical flow. Not yet researched for this company.',
    done: 'Done',
    next: 'Next step',
    upcoming: 'Upcoming',
    markDone: 'Mark done',
    undo: 'Undo',
    date: 'Date',
    time: 'Time',
    addToCalendar: 'Add to calendar',
    onCalendar: 'On your calendar',
    removeFromCalendar: 'Remove from calendar',
    allDone: 'Every step is done.',
    trackFirst: 'Track this role to follow your progress and add steps to your calendar.',
    trackRole: 'Track this role',
    yourApplication: 'Your application',
    status: 'Status',
    notTracked: 'Not tracked',
    applied: 'Applied',
    source: 'Source',
    fromGmail: mailbox => `Gmail · ${mailbox}`,
    addedByYou: 'Added by you',
    roles: count => `Roles at this company (${count})`,
    facts: 'Facts',
    location: 'Location',
    workMode: 'Work style',
    language: 'Language',
    duration: 'Duration',
    pay: 'Pay',
    deadline: 'Deadline',
    techStack: 'Tech stack',
    eligibility: 'Eligibility',
    sources: 'Sources',
    posting: 'Posting',
    careers: 'Careers site',
    verified: date => `Verified ${date}`,
    sample: 'Sample data',
    loadError: 'Could not load company research.',
  },
  ja: {
    back: '戻る',
    match: 'マッチ',
    createResume: 'この募集用の履歴書を作成',
    coverLetter: 'カバーレター',
    apply: '企業サイトで応募',
    about: '企業概要',
    noResearch: 'まだ企業リサーチがありません。リサーチ機能の接続後に表示されます。',
    fit: 'あなたに合う理由',
    fitPending: 'リサーチ機能の接続後、プロフィールとの相性を表示します。',
    steps: '選考フロー',
    fromPosting: '募集要項より',
    typical: '一般的な選考フローです。この企業の情報はまだ調査されていません。',
    done: '完了',
    next: '次のステップ',
    upcoming: '予定',
    markDone: '完了にする',
    undo: '元に戻す',
    date: '日付',
    time: '時刻',
    addToCalendar: 'カレンダーに追加',
    onCalendar: 'カレンダー登録済み',
    removeFromCalendar: 'カレンダーから削除',
    allDone: 'すべてのステップが完了しました。',
    trackFirst: 'この募集を管理対象にすると、進捗の記録とカレンダー登録ができます。',
    trackRole: '管理対象に追加',
    yourApplication: 'あなたの応募',
    status: '状況',
    notTracked: '未管理',
    applied: '応募日',
    source: '取得元',
    fromGmail: mailbox => `Gmail・${mailbox}`,
    addedByYou: '手動で追加',
    roles: count => `この企業の募集（${count}件）`,
    facts: '募集概要',
    location: '勤務地',
    workMode: '働き方',
    language: '言語',
    duration: '期間',
    pay: '報酬',
    deadline: '締切',
    techStack: '技術スタック',
    eligibility: '応募条件',
    sources: '情報源',
    posting: '募集ページ',
    careers: '採用サイト',
    verified: date => `${date} 確認`,
    sample: 'サンプルデータ',
    loadError: '企業リサーチを読み込めませんでした。',
  },
};

// Stable per-step key built from the English step text, so progress and calendar
// entries survive a language switch.
const slug = text => String(text || '').toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
const stepKey = (index, title) => `${index + 1}-${slug(title)}`;
const stepMilestoneId = key => `step-${key}`;

const formatDay = (value, isJa) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(isJa ? 'ja-JP' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Tokyo' }).format(date);
};

// A tracked record that has no catalog listing still needs the shape the
// tracker's write path expects (id, url...).
const itemFromRecord = record => ({
  id: record.internshipId,
  company: record.company,
  role: record.role,
  location: record.location,
  url: record.applyUrl,
  deadline: record.deadline,
  deadlineDate: record.deadlineDate,
  companyDomain: record.companyDomain,
  logoUrl: record.logoUrl,
  jobType: record.jobType,
  sourceMeta: record.sourceMeta,
  fromTracker: true,
});

export default function CompanyPage({ company, focusId, isJa = false, activeProfile, onBack }) {
  const t = COPY[isJa ? 'ja' : 'en'];
  const { openDocumentStudio } = useAppActions();
  const { catalog } = useInternshipCatalog();
  const { tracker, records, statusFor, updateStatus, updateRecord, addMilestone, removeMilestone } = useApplicationTracker(activeProfile);

  const roles = useMemo(() => {
    const listed = catalog.filter(item => sameCompany(item.company, company));
    const listedIds = new Set(listed.map(item => item.id));
    const trackedOnly = records
      .filter(record => sameCompany(record.company, company) && !listedIds.has(record.internshipId))
      .map(itemFromRecord);
    return [...listed, ...trackedOnly];
  }, [catalog, records, company]);

  const [selectedId, setSelectedId] = useState(focusId || null);
  const item = useMemo(() => roles.find(role => role.id === selectedId) || roles[0] || { id: null, company }, [roles, selectedId, company]);
  const record = item.id ? tracker[item.id] : null;
  const isListing = Boolean(item.id) && !item.fromTracker;
  const details = useMemo(() => (isListing ? internshipDetails(item) : null), [isListing, item]);
  const jobType = inferJobType(record || item);
  const cooldownMap = useMemo(() => companyCooldownMap(records), [records]);
  const cooldown = cooldownForCompany(cooldownMap, company);

  const [research, setResearch] = useState(null);
  const [researchError, setResearchError] = useState('');
  useEffect(() => {
    if (isListing) return undefined;
    let cancelled = false;
    setResearch(null);
    setResearchError('');
    companyApi.get(company, { jobType })
      .then(result => { if (!cancelled) setResearch(result); })
      .catch(() => { if (!cancelled) setResearchError(t.loadError); });
    return () => { cancelled = true; };
  }, [company, jobType, isListing, t.loadError]);

  // Steps: the posting's own process for a listing; otherwise whatever research
  // returned (labelled "typical" until phase 2 researches the company).
  const steps = useMemo(() => {
    if (isListing) {
      const en = details.process;
      const ja = details.processJa;
      return en.map((title, index) => ({ key: stepKey(index, title), title: isJa ? (ja[index] || title) : title }));
    }
    return (research?.steps || []).map((step, index) => ({ key: stepKey(index, step.title), title: isJa ? (step.titleJa || step.title) : step.title }));
  }, [isListing, details, research, isJa]);
  const stepsSource = isListing ? 'posting' : (research?.stepsSource || 'typical');

  const progress = record?.selectionProgress || {};
  const nextIndex = steps.findIndex(step => !progress[step.key]);
  const [drafts, setDrafts] = useState({});
  const [interviewPending, setInterviewPending] = useState(null);

  const toggleDone = step => {
    if (!record) return;
    const next = { ...progress };
    if (next[step.key]) delete next[step.key];
    else next[step.key] = { done: true, at: new Date().toISOString() };
    updateRecord(item.id, { selectionProgress: next });
  };
  const schedule = step => {
    const draft = drafts[step.key] || {};
    if (!record || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date || '')) return;
    addMilestone(item.id, { id: stepMilestoneId(step.key), kind: 'step', date: draft.date, time: draft.time || null, title: step.title });
    setDrafts(current => ({ ...current, [step.key]: {} }));
  };
  const unschedule = step => removeMilestone(item.id, stepMilestoneId(step.key));

  // Same rules as every other status control: a hand-picked status pins the
  // record against Gmail syncs, and Interview asks for a date first.
  const onStatus = value => {
    if (value === 'interview') { setInterviewPending(item); return; }
    updateStatus(item, value, { pin: true });
  };
  const onInterviewConfirm = value => {
    const target = interviewPending;
    if (!target) return;
    const [date, time = ''] = String(value || '').trim().split(/[ T]/);
    updateStatus(target, 'interview', { pin: true });
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) addMilestone(target.id, { kind: 'interview', date, time: time || null });
    setInterviewPending(null);
  };
  const onApply = () => {
    const current = statusFor(item.id);
    if (!current || current === 'saved') updateStatus(item, 'applying');
  };

  const [roleLead, ...roleDetails] = splitRole(displayRole(item.role, isJa));
  const companyName = displayCompany(item, isJa);
  const mailbox = record?.sourceMeta?.mailbox;
  const about = isListing ? (isJa ? details.aboutJa : details.about) : (isJa ? research?.summaryJa : research?.summary);

  return (
    <main className="company-page">
      <div className="company-page-top">
        <button type="button" className="company-back" onClick={onBack}><ArrowLeft size={15} /> {t.back}</button>
        {isSampleData && !isListing ? <span className="sample-pill">{t.sample}</span> : null}
      </div>

      <header className="company-hero">
        <CompanyLogo item={item} size="lg" />
        <div className="company-hero-text">
          <h1>{companyName}</h1>
          {item.role ? <p className="company-hero-role">{roleLead}{roleDetails.length ? <span> · {roleDetails.join(' · ')}</span> : null}</p> : null}
          <div className="company-hero-meta">
            <span className={`jobtype-chip ${jobType}`}>{jobTypeLabel(jobType, isJa)}</span>
            {item.location ? <span><MapPin size={13} />{displayValue(item.location, isJa)}</span> : null}
            {item.companyDomain ? <span>{item.companyDomain}</span> : null}
          </div>
        </div>
        {Number.isFinite(item.score) ? <div className="company-score"><b>{item.score}%</b><span>{t.match}</span></div> : null}
      </header>

      <div className="company-actions">
        {openDocumentStudio && item.id ? (
          <>
            <button type="button" className="company-action primary" onClick={() => openDocumentStudio(item)}><FileText size={15} /> {t.createResume}</button>
            <button type="button" className="company-action" onClick={() => openDocumentStudio(item, { kind: 'cover_letter' })}><PenLine size={15} /> {t.coverLetter}</button>
          </>
        ) : null}
        {cooldown ? (
          <span className="company-action disabled" aria-disabled="true"><CalendarClock size={15} /> {cooldownLabel(cooldown, isJa)}</span>
        ) : item.url ? (
          <a className="company-action" href={item.url} target="_blank" rel="noreferrer" onClick={onApply}>{t.apply} <ExternalLink size={14} /></a>
        ) : null}
      </div>

      <div className="company-grid">
        <div className="company-main">
          <section className="company-card">
            <h2>{t.about}</h2>
            {about ? <p>{displayValue(about, isJa)}</p> : <p className="company-muted">{researchError || t.noResearch}</p>}
          </section>

          <section className="company-card">
            <h2><Sparkles size={15} /> {t.fit}</h2>
            {isListing && (item.fitNote || item.reasons?.length) ? (
              <>
                {item.fitNote ? <p>{fitNoteDisplay(item, isJa)}</p> : null}
                <ul className="company-checks">
                  {(item.reasons || []).map(reason => <li key={reason}><Check size={13} />{reasonDisplay(reason, isJa)}</li>)}
                </ul>
              </>
            ) : <p className="company-muted">{t.fitPending}</p>}
          </section>

          <section className="company-card">
            <div className="company-card-head">
              <h2>{t.steps}</h2>
              <span className={`steps-source ${stepsSource}`}>{stepsSource === 'posting' ? t.fromPosting : t.typical}</span>
            </div>
            {!record && item.id ? (
              <div className="company-track-note">
                <span>{t.trackFirst}</span>
                <button type="button" onClick={() => updateStatus(item, 'saved')}>{t.trackRole}</button>
              </div>
            ) : null}
            <ol className="step-list">
              {steps.map((step, index) => {
                const done = Boolean(progress[step.key]);
                const isNext = index === nextIndex;
                const scheduled = record?.milestones?.find(milestone => milestone.id === stepMilestoneId(step.key));
                const draft = drafts[step.key] || {};
                return (
                  <li key={step.key} className={`step ${done ? 'done' : ''} ${isNext ? 'next' : ''}`}>
                    <span className="step-dot" aria-hidden="true">{done ? <Check size={13} /> : index + 1}</span>
                    <div className="step-body">
                      <div className="step-title">
                        <b>{step.title}</b>
                        <span className="step-state">{done ? t.done : isNext ? t.next : t.upcoming}</span>
                      </div>
                      {scheduled ? (
                        <div className="step-scheduled">
                          <CalendarClock size={13} /> {t.onCalendar} · {formatDay(`${scheduled.date}T12:00:00+09:00`, isJa)}{scheduled.time ? ` ${scheduled.time}` : ''}
                          <button type="button" onClick={() => unschedule(step)} aria-label={t.removeFromCalendar}><Trash2 size={12} /></button>
                        </div>
                      ) : isNext && record ? (
                        <div className="step-schedule">
                          <label><span>{t.date}</span><input type="date" value={draft.date || ''} onChange={event => setDrafts(current => ({ ...current, [step.key]: { ...draft, date: event.target.value } }))} /></label>
                          <label><span>{t.time}</span><input type="time" value={draft.time || ''} onChange={event => setDrafts(current => ({ ...current, [step.key]: { ...draft, time: event.target.value } }))} /></label>
                          <button type="button" disabled={!draft.date} onClick={() => schedule(step)}><CalendarPlus size={14} /> {t.addToCalendar}</button>
                        </div>
                      ) : null}
                    </div>
                    {record ? (
                      <button type="button" className="step-toggle" onClick={() => toggleDone(step)}>{done ? <><X size={12} /> {t.undo}</> : <><Check size={12} /> {t.markDone}</>}</button>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {record && steps.length && nextIndex === -1 ? <p className="company-muted">{t.allDone}</p> : null}
          </section>
        </div>

        <aside className="company-side">
          <section className="company-card">
            <h2>{t.yourApplication}</h2>
            {record ? (
              <dl className="company-facts">
                <dt>{t.status}</dt>
                <dd>
                  <select value={record.status} onChange={event => onStatus(event.target.value)} aria-label={t.status}>
                    {APPLICATION_STATUSES.map(option => <option key={option.value} value={option.value}>{statusLabel(option.value, isJa)}</option>)}
                  </select>
                </dd>
                {record.appliedAt ? <><dt>{t.applied}</dt><dd>{formatDay(record.appliedAt, isJa)}</dd></> : null}
                <dt>{t.source}</dt>
                <dd>{mailbox ? <span className="mailbox-chip"><Mail size={12} />{t.fromGmail(mailbox)}</span> : record.source === 'gmail' ? 'Gmail' : t.addedByYou}</dd>
              </dl>
            ) : item.id ? (
              <button type="button" className="company-track-btn" onClick={() => updateStatus(item, 'saved')}>{t.trackRole}</button>
            ) : <p className="company-muted">{t.notTracked}</p>}
            {cooldown ? <p className="company-cooldown"><CalendarClock size={13} /> {cooldown.reapplyNote || cooldownLabel(cooldown, isJa)}</p> : null}
          </section>

          {roles.length > 1 ? (
            <section className="company-card">
              <h2>{t.roles(roles.length)}</h2>
              <div className="company-roles">
                {roles.map(role => {
                  const roleStatus = statusFor(role.id);
                  return (
                    <button type="button" key={role.id} className={`company-role ${role.id === item.id ? 'active' : ''}`} onClick={() => setSelectedId(role.id)}>
                      <b>{displayRole(role.role, isJa)}</b>
                      <small>
                        <span className={`jobtype-chip ${inferJobType(tracker[role.id] || role)}`}>{jobTypeLabel(inferJobType(tracker[role.id] || role), isJa)}</span>
                        {roleStatus ? <span>{statusLabel(roleStatus, isJa)}</span> : null}
                        {role.deadline ? <span>{formatDeadline(role.deadline, isJa)}</span> : null}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {isListing ? (
            <section className="company-card">
              <h2>{t.facts}</h2>
              <dl className="company-facts">
                {item.location ? <><dt>{t.location}</dt><dd>{displayValue(item.location, isJa)}</dd></> : null}
                {item.workMode ? <><dt>{t.workMode}</dt><dd>{displayValue(item.workMode, isJa)}</dd></> : null}
                {item.language ? <><dt>{t.language}</dt><dd>{displayValue(item.language, isJa)}</dd></> : null}
                {item.duration ? <><dt>{t.duration}</dt><dd>{displayValue(item.duration, isJa)}</dd></> : null}
                {item.compensation ? <><dt>{t.pay}</dt><dd>{displayValue(item.compensation, isJa)}</dd></> : null}
                {item.deadline ? <><dt>{t.deadline}</dt><dd>{formatDeadline(item.deadline, isJa)}</dd></> : null}
              </dl>
            </section>
          ) : null}

          {isListing && details.techStack.length ? (
            <section className="company-card">
              <h2>{t.techStack}</h2>
              <div className="intern-chip-list">
                {details.techStack.map(entry => {
                  const icon = resolveTechIcon(entry);
                  return <span key={entry}><img src={icon.src} alt="" loading="lazy" onError={event => { event.currentTarget.src = icon.fallbackSrc; }} />{displayValue(entry, isJa)}</span>;
                })}
              </div>
            </section>
          ) : null}

          {isListing && (isJa ? details.eligibilityJa : details.eligibility).length ? (
            <section className="company-card">
              <h2>{t.eligibility}</h2>
              <ul className="company-checks">
                {(isJa ? details.eligibilityJa : details.eligibility).map(line => <li key={line}><ShieldCheck size={13} />{displayValue(line, isJa)}</li>)}
              </ul>
            </section>
          ) : null}

          {isListing && (item.url || item.companyUrl) ? (
            <section className="company-card">
              <h2>{t.sources}</h2>
              <div className="company-links">
                {item.url ? <a href={item.url} target="_blank" rel="noreferrer">{t.posting} <ExternalLink size={12} /></a> : null}
                {item.companyUrl ? <a href={item.companyUrl} target="_blank" rel="noreferrer">{t.careers} <ExternalLink size={12} /></a> : null}
              </div>
              {item.verifiedDate ? <small className="company-muted">{displayValue(item.source, isJa)} · {t.verified(item.verifiedDate)}</small> : null}
            </section>
          ) : null}
        </aside>
      </div>

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
