import React, { useState } from 'react';
import { ArrowRight, FilePenLine, FileText, GraduationCap, Mail, MapPin, Phone, Sparkles, Upload, X } from 'lucide-react';
import { displayValue } from '../utils/internshipDisplay.js';

// Pure helper (module scope — no props/state): a comma-list string → trimmed items.
const splitSkills = value => String(value || '').split(/,\s*/).map(s => s.trim()).filter(Boolean);

const copy = {
  en: {
    title: 'Profile',
    subtitle: 'Everything about you in one place — details, links, and your résumés.',
    contact: 'Contact & links',
    email: 'Email', phone: 'Phone', github: 'GitHub', linkedin: 'LinkedIn',
    education: 'Education', experience: 'Experience', skills: 'Skills', summary: 'Summary',
    skillLanguages: 'Languages', skillFrameworks: 'Frameworks & libraries', skillTools: 'Tools & platforms', skillOther: 'Other',
    resumes: 'Résumés & CVs',
    resumesSub: 'The résumé the app manages for you. File storage for extra CVs is coming soon.',
    openEditor: 'Open in Editor', activeResume: 'Active résumé',
    uploadSoon: 'Upload CV — coming soon',
    none: 'Not set',
    present: 'Present',
    edit: 'Edit profile',
    editTitle: 'Edit profile details',
    editHint: 'These write to the active résumé’s personal details.',
    nameEn: 'Name (English)', nameJa: 'Name (Japanese)',
    address: 'Address',
    save: 'Save changes', saving: 'Saving…', cancel: 'Cancel',
    saveError: 'Could not save profile.',
  },
  ja: {
    title: 'プロフィール',
    subtitle: 'あなたに関する情報を一か所に — 詳細、リンク、履歴書。',
    contact: '連絡先・リンク',
    email: 'メール', phone: '電話', github: 'GitHub', linkedin: 'LinkedIn',
    education: '学歴', experience: '職歴', skills: 'スキル', summary: '概要',
    skillLanguages: '言語', skillFrameworks: 'フレームワーク・ライブラリ', skillTools: 'ツール・プラットフォーム', skillOther: 'その他',
    resumes: '履歴書・CV',
    resumesSub: 'アプリが管理する履歴書です。追加のCVファイル保存は近日対応予定です。',
    openEditor: 'エディタで開く', activeResume: '現在の履歴書',
    uploadSoon: 'CVをアップロード — 近日対応',
    none: '未設定',
    present: '現在',
    edit: 'プロフィールを編集',
    editTitle: 'プロフィール情報を編集',
    editHint: 'アクティブな履歴書の個人情報に反映されます。',
    nameEn: '氏名（英語）', nameJa: '氏名（日本語）',
    address: '住所',
    save: '変更を保存', saving: '保存中…', cancel: 'キャンセル',
    saveError: '保存できませんでした。',
  },
};

function InfoRow({ icon, label, value, href }) {
  if (!value) return null;
  return (
    <div className="profile-info-row">
      <span className="profile-info-icon" aria-hidden="true">{icon}</span>
      <span className="profile-info-body">
        <small>{label}</small>
        {href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : <b>{value}</b>}
      </span>
    </div>
  );
}

export default function ProfileView({ resume, isJa, onOpenEditor, onSavePersonal }) {
  const t = isJa ? copy.ja : copy.en;
  const p = resume.personal || {};

  // Inline profile editing (moved here from Settings): edits write straight to
  // the résumé's personal block via onSavePersonal.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const startEditing = () => {
    setForm({
      nameEn: p.nameEn || '',
      nameJa: p.nameJa || '',
      email: p.email || '',
      phone: p.phone || '',
      github: p.github || '',
      linkedin: p.linkedin || '',
      address: p.address || '',
    });
    setSaveError('');
    setEditing(true);
  };
  const saveEdits = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSavePersonal({
        ...p,
        nameEn: form.nameEn.trim(),
        nameJa: form.nameJa.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        github: form.github.trim(),
        linkedin: form.linkedin.trim(),
        address: form.address.trim(),
      });
      setEditing(false);
    } catch (error) {
      setSaveError(error.message || t.saveError);
    } finally {
      setSaving(false);
    }
  };
  const editField = (key, label, type = 'text') => (
    <label className="profile-edit-field">
      <span>{label}</span>
      <input type={type} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </label>
  );
  const name = isJa
    ? (p.nameJa || p.nameEn || '名前未設定')
    : (p.nameEn || p.nameJa || 'Name not set');
  const education = resume.education || [];
  const experience = resume.experience || [];
  const skills = resume.skills || {};
  // Skills grouped by kind (languages / frameworks / tools) so the panel reads
  // as tidy labeled rows instead of one long chip soup.
  const skillGroups = (Array.isArray(skills)
    ? [{ label: t.skillOther, items: skills.filter(Boolean) }]
    : [
        { label: t.skillLanguages, items: splitSkills(skills.languages) },
        { label: t.skillFrameworks, items: splitSkills(skills.frameworks) },
        { label: t.skillTools, items: splitSkills(skills.tools) },
      ]).filter(group => group.items.length);
  const summary = isJa ? (resume.summaryJa || resume.summary) : (resume.summaryEn || resume.summary);
  const firstEdu = education[0];
  const eduLine = firstEdu
    ? [(isJa ? firstEdu.institutionJa : firstEdu.institution) || firstEdu.institution, firstEdu.endDate].filter(Boolean).join(' · ')
    : '';
  const location = firstEdu?.location || p.address || '';
  const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2);

  const range = item => [item.startDate, item.endDate || t.present].filter(Boolean).join(' – ');

  return (
    <main className="profile-view">
      <div className="section-heading">
        <div><h2>{t.title}</h2><p>{t.subtitle}</p></div>
        {onSavePersonal && !editing ? (
          <button type="button" onClick={startEditing}><FilePenLine size={13} /> {t.edit}</button>
        ) : null}
      </div>

      <section className="profile-view-hero">
        <div className="profile-view-avatar">
          {p.photoDataUrl ? <img src={p.photoDataUrl} alt={name} /> : <span>{initials}</span>}
        </div>
        <div className="profile-view-idents">
          <h1>{name}</h1>
          {location ? <p><MapPin size={15} /> {displayValue(location, isJa)}</p> : null}
          {eduLine ? <p><GraduationCap size={15} /> {eduLine}</p> : null}
        </div>
      </section>

      <div className="profile-view-grid">
        {editing ? (
          <section className="profile-panel profile-panel-wide profile-edit-panel">
            <h3><FilePenLine size={15} /> {t.editTitle}</h3>
            <p className="profile-panel-sub">{t.editHint}</p>
            <div className="profile-edit-grid">
              {editField('nameEn', t.nameEn)}
              {editField('nameJa', t.nameJa)}
              {editField('email', t.email, 'email')}
              {editField('phone', t.phone, 'tel')}
              {editField('github', t.github, 'url')}
              {editField('linkedin', t.linkedin, 'url')}
              {editField('address', t.address)}
            </div>
            {saveError ? <div className="profile-edit-error" role="alert">{saveError}</div> : null}
            <div className="profile-edit-actions">
              <button type="button" className="profile-edit-cancel" onClick={() => setEditing(false)} disabled={saving}><X size={13} /> {t.cancel}</button>
              <button type="button" className="profile-edit-save" onClick={saveEdits} disabled={saving}>{saving ? t.saving : t.save}</button>
            </div>
          </section>
        ) : null}
        <section className="profile-panel">
          <h3>{t.contact}</h3>
          <div className="profile-info-list">
            <InfoRow icon={<Mail size={15} />} label={t.email} value={p.email} href={p.email ? `mailto:${p.email}` : undefined} />
            <InfoRow icon={<Phone size={15} />} label={t.phone} value={p.phone} />
            <InfoRow icon={<ArrowRight size={15} />} label={t.github} value={p.github ? p.github.replace(/^https?:\/\/(www\.)?/, '') : ''} href={p.github} />
            <InfoRow icon={<ArrowRight size={15} />} label={t.linkedin} value={p.linkedin ? p.linkedin.replace(/^https?:\/\/(www\.)?/, '') : ''} href={p.linkedin} />
          </div>
        </section>

        {skillGroups.length ? (
          <section className="profile-panel">
            <h3><Sparkles size={15} /> {t.skills}</h3>
            <div className="profile-skill-groups">
              {skillGroups.map(group => (
                <div className="profile-skill-group" key={group.label}>
                  <small>{group.label}</small>
                  <div className="profile-skill-tags">
                    {group.items.map((s, i) => <span key={`${s}-${i}`} className="profile-skill-tag">{s}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {education.length ? (
          <section className="profile-panel">
            <h3>{t.education}</h3>
            <div className="profile-entry-list">
              {education.map(edu => (
                <div className="profile-entry" key={edu.id ?? `${edu.institution}-${range(edu)}`}>
                  <b>{(isJa ? edu.institutionJa : edu.institution) || edu.institution || t.none}</b>
                  <small>{[(isJa ? edu.degreeJa : edu.degree) || edu.degree, range(edu)].filter(Boolean).join(' · ')}</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {experience.length ? (
          <section className="profile-panel">
            <h3>{t.experience}</h3>
            <div className="profile-entry-list">
              {experience.reduce((rows, exp) => {
                if (!(exp.company || exp.companyJa)) return rows;
                const label = `${(isJa ? exp.roleJa : exp.role) || exp.role || ''}${((isJa ? exp.companyJa : exp.company) || exp.company) ? ` · ${(isJa ? exp.companyJa : exp.company) || exp.company}` : ''}`;
                rows.push(
                  <div className="profile-entry" key={`${label}-${range(exp)}`}>
                    <b>{label}</b>
                    <small>{range(exp)}</small>
                  </div>,
                );
                return rows;
              }, [])}
            </div>
          </section>
        ) : null}

        {summary ? (
          <section className="profile-panel profile-panel-wide">
            <h3>{t.summary}</h3>
            <p className="profile-summary">{summary}</p>
          </section>
        ) : null}

        <section className="profile-panel profile-panel-wide profile-resumes">
          <h3><FileText size={15} /> {t.resumes}</h3>
          <p className="profile-panel-sub">{t.resumesSub}</p>
          <div className="profile-resume-row">
            <div className="profile-resume-item">
              <span className="profile-resume-icon" aria-hidden="true"><FileText size={17} /></span>
              <span><b>{t.activeResume}</b><small>{name}</small></span>
              <button type="button" className="profile-resume-open" onClick={onOpenEditor}>{t.openEditor} <ArrowRight size={13} /></button>
            </div>
            <button type="button" className="profile-resume-upload" disabled title={t.uploadSoon}>
              <Upload size={15} /> {t.uploadSoon}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
