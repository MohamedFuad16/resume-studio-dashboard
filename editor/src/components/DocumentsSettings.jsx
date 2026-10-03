// Settings › Résumé and Cover letter (rebuild U4). Two read-only templates the
// AI registers from the uploaded résumé, plus the drafts saved from the studio.
// Not editable here on purpose: the template changes only when a newer résumé
// PDF is uploaded, so every tailored document starts from the same facts.
import { useEffect, useMemo, useState } from 'react';
import { FileText, PenLine, Trash2 } from 'lucide-react';
import ResumeUpload from './ResumeUpload.jsx';
import { documentsApi, isSampleData } from '../api/v2/index.js';
import { KIND_LABELS, masterProfileFromResume, tailorDocument } from '../documents/tailor.js';
import { useAppActions } from '../context/AppActions.js';

const COPY = {
  en: {
    resumeTitle: 'Résumé template',
    resumeHint: 'Built once from your résumé PDF. Every tailored résumé, CV, 履歴書 and 職務経歴書 starts from these facts, so a draft never contains anything you did not write.',
    letterTitle: 'Cover letter template',
    letterHint: 'The structure every cover letter starts from. The AI fills it in for each company when you create one.',
    counts: c => `${c.education} ${c.education === 1 ? 'school' : 'schools'} · ${c.experience} ${c.experience === 1 ? 'role' : 'roles'} · ${c.projects} projects · ${c.skills} skills`,
    topSkills: 'Top skills',
    readOnly: 'Not editable here. Upload a newer résumé PDF to rebuild it.',
    empty: 'No résumé yet. Upload your PDF to build the template.',
    drafts: 'Saved drafts',
    noDrafts: 'No drafts yet. Open a company and choose "Create a résumé for this role".',
    open: 'Open',
    delete: 'Delete',
    sample: 'Sample data',
  },
  ja: {
    resumeTitle: '履歴書テンプレート',
    resumeHint: '履歴書PDFから一度だけ作成します。レジュメ・CV・履歴書・職務経歴書はすべてこの情報から作るため、書いていない内容が入ることはありません。',
    letterTitle: 'カバーレターのテンプレート',
    letterHint: 'すべてのカバーレターの基本構成です。作成時にAIが企業ごとに内容を埋めます。',
    counts: c => `学歴${c.education}件・職歴${c.experience}件・プロジェクト${c.projects}件・スキル${c.skills}件`,
    topSkills: '主なスキル',
    readOnly: 'ここでは編集できません。新しい履歴書PDFをアップロードすると作り直されます。',
    empty: 'まだ履歴書がありません。PDFをアップロードするとテンプレートが作成されます。',
    drafts: '保存した下書き',
    noDrafts: 'まだ下書きはありません。企業ページで「この募集用の履歴書を作成」を選んでください。',
    open: '開く',
    delete: '削除',
    sample: 'サンプルデータ',
  },
};

const formatDate = (value, isJa) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(isJa ? 'ja-JP' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

export default function DocumentsSettings({ resume, isJa = false, onResumeParsed, onUploadError }) {
  const t = COPY[isJa ? 'ja' : 'en'];
  const { openDocumentStudio } = useAppActions();
  const profile = useMemo(() => masterProfileFromResume(resume), [resume]);
  const letter = useMemo(() => tailorDocument({ profile, job: {}, lang: isJa ? 'ja' : 'en', kind: 'cover_letter' }).letter, [profile, isJa]);
  const skills = profile.skillGroups.flatMap(group => group.items).slice(0, 12);
  const hasProfile = Boolean(profile.name.en || profile.name.ja || profile.counts.projects || profile.counts.education);
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    documentsApi.list().then(list => { if (!cancelled) setDrafts(Array.isArray(list) ? list : []); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const removeDraft = async id => {
    await documentsApi.remove(id).catch(() => {});
    setDrafts(current => current.filter(doc => doc.id !== id));
  };

  return (
    <>
      <section className="settings-card documents-card">
        <header className="mailboxes-head">
          <div><h2><FileText size={15} /> {t.resumeTitle}</h2><p>{t.resumeHint}</p></div>
          {isSampleData ? <span className="sample-pill">{t.sample}</span> : null}
        </header>
        {hasProfile ? (
          <div className="template-summary">
            <div className="template-person">
              <b>{isJa ? (profile.name.ja || profile.name.en) : (profile.name.en || profile.name.ja)}</b>
              <small>{[profile.contact.email, profile.contact.phone].filter(Boolean).join(' · ')}</small>
              <small className="template-counts">{t.counts(profile.counts)}</small>
            </div>
            {skills.length ? (
              <div className="template-skills">
                <small>{t.topSkills}</small>
                <div>{skills.map(skill => <span key={skill}>{skill}</span>)}</div>
              </div>
            ) : null}
            {(isJa ? profile.summary.ja : profile.summary.en) ? <p className="template-summary-text">{isJa ? profile.summary.ja : profile.summary.en}</p> : null}
          </div>
        ) : <p className="settings-note">{t.empty}</p>}
        <div className="template-foot">
          <small className="settings-note">{t.readOnly}</small>
          {onResumeParsed ? <ResumeUpload isJa={isJa} onParsed={onResumeParsed} onError={onUploadError} className="profile-resume-upload" /> : null}
        </div>
      </section>

      <section className="settings-card documents-card">
        <header><h2><PenLine size={15} /> {t.letterTitle}</h2><p>{t.letterHint}</p></header>
        <div className="template-letter">
          <span>{letter.greeting}</span>
          {letter.paragraphs.map(text => <p key={text}>{text}</p>)}
          <span>{letter.closing} {letter.signature}</span>
        </div>
        <small className="settings-note">{t.readOnly}</small>
      </section>

      <section className="settings-card documents-card">
        <header><h2>{t.drafts}</h2></header>
        {drafts.length ? (
          <div className="draft-list">
            {drafts.map(doc => (
              <div className="draft-row" key={doc.id}>
                <FileText size={16} aria-hidden="true" />
                <div>
                  <b>{isJa ? KIND_LABELS[doc.kind]?.ja : KIND_LABELS[doc.kind]?.en} · {doc.lang === 'ja' ? '日本語' : 'English'}</b>
                  <small>{[doc.target?.company, doc.target?.role].filter(Boolean).join(' · ')} · {formatDate(doc.updatedAt, isJa)}</small>
                </div>
                {openDocumentStudio ? <button type="button" className="btn" onClick={() => openDocumentStudio(doc.target, { doc })}>{t.open}</button> : null}
                <button type="button" className="btn mailbox-remove" onClick={() => removeDraft(doc.id)} aria-label={`${t.delete}: ${doc.target?.company || ''}`}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        ) : <p className="settings-note">{t.noDrafts}</p>}
      </section>
    </>
  );
}
