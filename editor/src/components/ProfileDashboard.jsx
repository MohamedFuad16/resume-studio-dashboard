import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  Check,
  Inbox,
  FilePenLine,
  GraduationCap,
  MapPin,
  Send,
} from 'lucide-react';
import { APPLICATION_STATUSES, statusLabel, useApplicationTracker } from '../hooks/useApplicationTracker.js';
import { useInternshipCatalog } from '../hooks/useInternshipCatalog.js';
import { CompanyLogo } from './CompanyLogo.jsx';
import InterviewDateModal from './InterviewDateModal.jsx';
import { displayCompany, displayRole, displayValue, formatDisplayDeadline } from '../utils/internshipDisplay.js';
import { prepareProfilePhoto } from '../utils/imageUpload.js';
import { appliedCompaniesForProfile, compareCompanyAwareMatch } from '../utils/internshipRanking.js';
import { resolveTechList } from '../utils/techIcons.js';

const STATUS_ICONS = {
  saved: Bookmark,
  applying: FilePenLine,
  applied: Send,
  interview: CalendarClock,
};

const APPLIED_STATUSES = new Set(['applying', 'applied', 'interview']);

const dashboardValue = (value, isJa) => {
  return displayValue(value, isJa);
};

const graduationValue = (value, isJa) => {
  if (!isJa) return value;
  const months = { Jan: '1月', Feb: '2月', Mar: '3月', Apr: '4月', May: '5月', Jun: '6月', Jul: '7月', Aug: '8月', Sep: '9月', Oct: '10月', Nov: '11月', Dec: '12月' };
  const match = String(value || '').match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})(?:\s+\(Expected\))?$/i);
  return match ? `${match[2]}年${months[match[1].slice(0, 1).toUpperCase() + match[1].slice(1, 3).toLowerCase()]}（予定）` : displayValue(value, true).replace(/\s*\(Expected\)$/i, '（予定）');
};

const copy = {
  en: {
    uploadPhoto: 'Upload profile photo',
    graduation: value => `Expected graduation: ${value}`,
    complete: 'complete',
    readiness: 'Resume readiness',
    ready: 'Ready to tailor for each role.',
    missing: 'Add missing details for stronger applications.',
    tune: 'Tune resume',
    pipeline: 'Application pipeline',
    rolesTracked: count => `${count} ${count === 1 ? 'role' : 'roles'} tracked`,
    recent: 'Recent applications',
    recentSub: 'Keep every application and next step in one place.',
    browse: 'Browse internships',
    companyRole: 'Company & role',
    deadline: 'Deadline',
    status: 'Status',
    notApplied: 'Not applied',
    nextStep: 'Next step',
    continue: 'Continue',
    noApps: 'No applications tracked yet',
    noAppsSub: 'Save or start a role in Internship Radar and it will appear here.',
    explore: 'Explore Tokyo roles',
    projects: 'Projects',
    projectsSub: 'Your strongest proof of shipped engineering work.',
    editProjects: 'Edit projects',
    viewProject: 'Open GitHub project',
    tokyo: 'Tokyo opportunities',
    tokyoSub: 'Highest-priority matches nearby.',
    viewJapan: 'View all Japan matches',
    ranking: 'Japan-first ranking',
    rankingSub: 'Tokyo and Japan roles stay above global opportunities when match quality is similar.',
  },
  ja: {
    uploadPhoto: 'プロフィール写真をアップロード',
    location: '東京、日本',
    graduation: value => `卒業予定: ${value}`,
    complete: '完了',
    readiness: '履歴書の完成度',
    ready: '応募先ごとに調整できます。',
    missing: '不足情報を追加すると応募力が上がります。',
    tune: '履歴書を調整',
    pipeline: '応募状況',
    rolesTracked: count => `${count}件を管理中`,
    recent: '最近の応募',
    recentSub: '応募先と次のアクションを一か所で管理します。',
    browse: 'インターンを見る',
    companyRole: '企業・職種',
    deadline: '締切',
    status: '状況',
    notApplied: '未応募',
    nextStep: '次の対応',
    continue: '続きへ',
    noApps: '管理中の応募はありません',
    noAppsSub: 'インターン検索で保存または応募開始するとここに表示されます。',
    explore: '東京の募集を見る',
    projects: 'プロジェクト',
    projectsSub: '実装経験を示す主要な成果物です。',
    editProjects: 'プロジェクトを編集',
    viewProject: 'GitHubで開く',
    tokyo: '東京の注目募集',
    tokyoSub: '近くで優先度の高い募集です。',
    viewJapan: '日本の募集をすべて見る',
    ranking: '日本優先ランキング',
    rankingSub: '同程度の適合度では、東京・日本の募集を上位に表示します。',
  },
};

function GithubMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.22c-3.23.7-3.91-1.37-3.91-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.39.97.1-.75.41-1.27.74-1.56-2.58-.29-5.29-1.29-5.29-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.4-2.72 5.38-5.3 5.67.42.36.79 1.07.79 2.16v3.21c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z" /></svg>;
}

function LinkedinMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V8.98h3.42v1.57h.05c.47-.9 1.64-1.85 3.37-1.85 3.61 0 4.27 2.37 4.27 5.46v6.29ZM5.32 7.41a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.1 20.45H3.54V8.98H7.1v11.47Z" /></svg>;
}

function profileCompletion(resume) {
  const checks = [
    resume.personal?.nameEn || resume.personal?.nameJa,
    resume.personal?.email,
    resume.personal?.phone,
    resume.personal?.github,
    resume.personal?.linkedin,
    resume.summary,
    resume.education?.length,
    resume.experience?.filter(item => item.company || item.companyJa).length,
    resume.projects?.length,
    resume.skills?.languages,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function ProfileDashboard({ resume, onOpenRadar, onOpenEditor, onResumeChange, isJa, activeProfile }) {
  const t = isJa ? copy.ja : copy.en;
  const fileRef = useRef(null);
  const [interviewPending, setInterviewPending] = useState(null);
  const { records, counts, updateStatus, addMilestone } = useApplicationTracker(activeProfile);
  const { catalog } = useInternshipCatalog();
  const completion = profileCompletion(resume);
  const recent = useMemo(
    () => records.filter(record => APPLIED_STATUSES.has(record.status)).slice(0, 5),
    [records],
  );
  const tokyoMatches = useMemo(() => {
    const appliedCompanies = appliedCompaniesForProfile(activeProfile, records);
    return catalog
      .filter(item => /Tokyo|東京/i.test(item.location))
      .sort((a, b) => compareCompanyAwareMatch(a, b, appliedCompanies))
      .slice(0, 4);
  }, [activeProfile, catalog, records]);
  const name = isJa
    ? (resume.personal?.nameJa || resume.personal?.nameEn || '名前未設定')
    : (resume.personal?.nameEn || resume.personal?.nameJa || 'Name not set');
  const education = resume.education?.[0];
  const profileLocation = education?.location || resume.personal?.address || '';
  const institution = (isJa ? education?.institutionJa : education?.institution) || education?.institution || '';
  const graduation = education?.endDate || '';
  const projects = (resume.projects || []).slice(0, 4);

  const onPhoto = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const photoDataUrl = await prepareProfilePhoto(file);
      onResumeChange({
        ...resume,
        personal: { ...resume.personal, photoDataUrl },
        personalInfo: { ...resume.personalInfo, photoDataUrl },
      }, { immediate: true, refreshFromServer: true });
    } catch (error) {
      window.alert(error.message || 'Could not upload profile photo.');
    }
  };

  const onStatusChange = (item, value) => {
    if (value === 'interview') {
      setInterviewPending(item);
      return;
    }
    updateStatus(item, value);
  };

  const onInterviewConfirm = value => {
    const item = interviewPending;
    if (!item) return;
    const [date, time = ''] = String(value || '').trim().split(/[ T]/);
    updateStatus(item, 'interview');
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      addMilestone(item.id, { kind: 'interview', date, time: time || null });
    }
    setInterviewPending(null);
  };

  return (
    <main className="profile-dashboard">
      <section className="profile-hero">
        <div className="profile-identity">
          <button className="profile-photo" type="button" onClick={() => fileRef.current?.click()} aria-label={t.uploadPhoto}>
            {resume.personal?.photoDataUrl
              ? <img src={resume.personal.photoDataUrl} alt={name} />
              : <span>{name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)}</span>}
            <i><Camera size={16} /></i>
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onPhoto} hidden />
          <div>
            <h1>{name}</h1>
            {profileLocation ? <p><MapPin size={15} /> {dashboardValue(profileLocation, isJa)}</p> : null}
            {institution || graduation ? <p><GraduationCap size={15} /> {[institution, graduation ? t.graduation(graduationValue(graduation, isJa)) : ''].filter(Boolean).join(' · ')}</p> : null}
          </div>
        </div>

        <div className="profile-socials">
          {resume.personal?.github ? <a href={resume.personal.github} target="_blank" rel="noreferrer"><span className="brand-mark github"><GithubMark /></span><b>GitHub</b><small>{resume.personal.github.replace(/^https?:\/\/(www\.)?/, '')}</small></a> : null}
          {resume.personal?.linkedin ? <a href={resume.personal.linkedin} target="_blank" rel="noreferrer"><span className="brand-mark linkedin"><LinkedinMark /></span><b>LinkedIn</b><small>{resume.personal.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</small></a> : null}
        </div>

        <div className="profile-completion">
          <div className="completion-ring" style={{ '--completion': `${completion * 3.6}deg` }}><strong>{completion}%</strong><span>{t.complete}</span></div>
          <div><b>{t.readiness}</b><p>{completion === 100 ? t.ready : t.missing}</p><button type="button" onClick={onOpenEditor}>{t.tune} <ArrowRight size={14} /></button></div>
        </div>
      </section>

      <section className="pipeline-strip" aria-label={t.pipeline}>
        <div className="pipeline-title"><BriefcaseBusiness size={19} /><span><b>{t.pipeline}</b><small>{t.rolesTracked(records.length)}</small></span></div>
        {APPLICATION_STATUSES.map(item => {
          const Icon = STATUS_ICONS[item.value];
          return <div className={`pipeline-stat ${item.value}`} key={item.value}><Icon size={17} /><span><strong>{counts[item.value] || 0}</strong><small>{statusLabel(item.value, isJa)}</small></span></div>;
        })}
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-main">
          <div className="section-heading"><div><h2>{t.recent}</h2><p>{t.recentSub}</p></div><button type="button" onClick={onOpenRadar}>{t.browse} <ArrowRight size={15} /></button></div>
          <div className="application-list">
            <div className="application-list-head"><span>{t.companyRole}</span><span>{isJa ? '場所' : 'Location'}</span><span>{t.deadline}</span><span>{t.status}</span><span>{t.nextStep}</span></div>
            {recent.length ? recent.map(record => {
              const item = catalog.find(entry => entry.id === record.internshipId)
                || { ...record, id: record.internshipId, url: record.applyUrl };
              return (
                <article className="application-row" key={record.internshipId}>
                  <span className="application-company"><CompanyLogo item={item} /><span><b>{displayCompany(item, isJa)}</b><small>{displayRole(item.role || record.role, isJa)}</small></span></span>
                  <span><MapPin size={13} />{dashboardValue(record.location, isJa)}</span>
                  <span className="application-deadline">{formatDisplayDeadline(record.deadline, isJa)}</span>
                  <select value={record.status} onChange={event => onStatusChange(item, event.target.value)} aria-label={isJa ? `${record.company}の応募状況` : `Status for ${record.company}`}>
                    {APPLICATION_STATUSES.map(status => <option value={status.value} key={status.value}>{statusLabel(status.value, isJa)}</option>)}
                    <option value="">{t.notApplied}</option>
                  </select>
                  <a href={record.applyUrl} target="_blank" rel="noreferrer">{t.continue} <ArrowRight size={14} /></a>
                </article>
              );
            }) : (
              <div className="application-empty"><span className="application-empty-icon" aria-hidden="true"><Inbox size={20} /></span><b>{t.noApps}</b><span>{t.noAppsSub}</span><button type="button" onClick={onOpenRadar}>{t.explore}</button></div>
            )}
          </div>

          <div className="section-heading project-heading"><div><h2>{t.projects}</h2><p>{t.projectsSub}</p></div><button type="button" onClick={onOpenEditor}>{t.editProjects} <FilePenLine size={14} /></button></div>
          <div className="project-grid">
            {projects.map(project => (
              <a className="project-card" key={project.title} href={project.link} target="_blank" rel="noreferrer" aria-label={`${t.viewProject}: ${project.title}`} aria-disabled={project.link ? undefined : true} onClick={project.link ? undefined : event => event.preventDefault()}>
                <span className="project-tech-icons" aria-label={isJa ? '使用技術' : 'Technologies used'}>
                  {resolveTechList(project.tech).slice(0, 6).map(t => (
                    <span className="project-tech-icon" key={t.key} title={t.label}>
                      <img src={t.src} alt={t.label} loading="lazy" onError={e=>{e.currentTarget.src=t.fallbackSrc;}} />
                    </span>
                  ))}
                </span>
                <h3>{project.title}</h3>
                <p>{(isJa ? project.bulletsJa?.[0] : project.bullets?.[0]) || project.description}</p>
                <em><span className="project-github-mark"><GithubMark /></span>{t.viewProject}</em>
              </a>
            ))}
          </div>
        </section>

        <aside className="dashboard-rail">
          <div className="rail-heading"><div><h2>{t.tokyo}</h2><p>{t.tokyoSub}</p></div><span className="rail-heading-mark" aria-hidden="true"><MapPin size={17} /></span></div>
          <div className="tokyo-list">
            {tokyoMatches.map(item => (
              <button type="button" key={item.id} onClick={onOpenRadar}>
                <CompanyLogo item={item} />
                <span><b>{displayCompany(item, isJa)}</b><small>{displayRole(item.role, isJa)}</small><em><MapPin size={11} />{dashboardValue(item.location, isJa)}</em></span>
                <strong>{item.score}%</strong>
              </button>
            ))}
          </div>
          <button className="rail-action" type="button" onClick={onOpenRadar}>{t.viewJapan} <ArrowRight size={15} /></button>
          <div className="rail-tip"><span className="rail-tip-icon" aria-hidden="true"><Check size={15} /></span><div><b>{t.ranking}</b><p>{t.rankingSub}</p></div></div>
        </aside>
      </div>
      {/* Application timeline moved to its own view (sidebar → Application timeline). */}
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
