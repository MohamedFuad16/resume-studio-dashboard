import React from 'react';
import { Sec, Inp, Txta, Bullets, I, TagInput, SuggestInput } from './ui.jsx';
import { prepareProfilePhoto } from '../utils/imageUpload.js';

function GithubMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.22c-3.23.7-3.91-1.37-3.91-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.39.97.1-.75.41-1.27.74-1.56-2.58-.29-5.29-1.29-5.29-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.4-2.72 5.38-5.3 5.67.42.36.79 1.07.79 2.16v3.21c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z" /></svg>;
}

function LinkedinMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V8.98h3.42v1.57h.05c.47-.9 1.64-1.85 3.37-1.85 3.61 0 4.27 2.37 4.27 5.46v6.29ZM5.32 7.41a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.1 20.45H3.54V8.98H7.1v11.47Z" /></svg>;
}

/* ── Personal — card-grouped layout ────────────────────── */
export function PersonalSec({ data: d, onChange, isJa }) {
  const s = (k, v) => onChange({ ...d, [k]: v });
  const emailParts = (d.email || '').split('@');
  const emailLocal = emailParts[0] || '';
  const emailDomain = emailParts.slice(1).join('@') || 'gmail.com';
  const emailDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'yahoo.com', 'tokai.ac.jp'];
  const [zip, setZip] = React.useState('');
  const [lookupState, setLookupState] = React.useState('idle');
  const linkedinOk = !d.linkedin || /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/.test(d.linkedin.trim());
  const githubOk = !d.github || /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_-]+\/?$/.test(d.github.trim());
  const setEmail = (local, domain) => {
    const safeLocal = local.replace(/@/g, '').trim();
    s('email', safeLocal ? `${safeLocal}@${domain}` : '');
  };
  const lookupZip = async () => {
    const digits = zip.replace(/\D/g, '');
    if (digits.length !== 7) {
      setLookupState('error');
      return;
    }
    setLookupState('loading');
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`);
      const json = await res.json();
      const result = json?.results?.[0];
      if (!result) throw new Error('not-found');
      s('address', `${result.address1}${result.address2}${result.address3}`);
      setLookupState('done');
    } catch {
      setLookupState('error');
    }
  };

  return (
    <Sec icon="user" label={isJa ? "個人情報" : "Personal Info"} testId="section-personal-title" open>
      <div className="personal-grid">

        {/* Identity block */}
        <div className="pg-block">
          <div className="pg-block-label">
            <I n="user" s={10} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.7 }} />
            {isJa ? "基本情報" : "Identity"}
          </div>
          <div className="flds">
            <div className="photo-field">
              <div className="photo-preview">
                {d.photoDataUrl ? (
                  <img src={d.photoDataUrl} alt="" />
                ) : (
                  <span>{isJa ? '写真' : 'Photo'}</span>
                )}
              </div>
              <div className="photo-copy">
                <span className="photo-kicker">{isJa ? '証明写真（任意）' : 'ID photo (optional)'}</span>
                <small>{isJa ? '証明写真の標準比率（縦4：横3）。JPEG・PNG・WebPに対応。' : 'Standard portrait ratio: 4 high × 3 wide. JPEG, PNG, or WebP.'}</small>
                <label className="photo-upload">
                  <I n="file" s={12} />
                  {isJa ? '証明写真を追加' : 'Add ID photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      try {
                        s('photoDataUrl', await prepareProfilePhoto(file));
                      } catch (error) {
                        window.alert(error.message || 'Could not upload photo.');
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="row2">
              <Inp label={isJa ? "氏名（英語）" : "Full name"} name="fullName" value={d.nameEn} onChange={v => s('nameEn', v)} placeholder="Mohamed Fuad" />
              <Inp label={isJa ? "氏名（日本語）" : "Japanese name"} name="fullNameJa" value={d.nameJa} onChange={v => s('nameJa', v)} placeholder="モハメド フアド" />
            </div>
            <div className="row2">
              <Inp label={isJa ? "ふりがな" : "Furigana"} name="furigana" value={d.furigana} onChange={v => s('furigana', v)} placeholder="もはめど ふあど" />
              <Inp label={isJa ? "生年月日" : "Date of birth"} name="dob" value={d.dob} onChange={v => s('dob', v)} placeholder="2004-02-28" />
            </div>
          </div>
        </div>

        {/* Contact block */}
        <div className="pg-block">
          <div className="pg-block-label">
            <I n="file" s={10} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.7 }} />
            {isJa ? "連絡先" : "Contact"}
          </div>
          <div className="flds">
            <div className="row2">
              <Inp label={isJa ? "電話番号" : "Phone"} name="phone" value={d.phone} onChange={v => s('phone', v)} placeholder="080-0000-0000" />
              <div className="f">
                <span className="fl">{isJa ? "メールアドレス" : "Email"}</span>
                <div className="email-split">
                  <input
                    className="fi"
                    value={emailLocal}
                    onChange={e => setEmail(e.target.value, emailDomain)}
                    placeholder="mohamed.fuad"
                    inputMode="email"
                  />
                  <span>@</span>
                  <select className="fi" value={emailDomain} onChange={e => setEmail(emailLocal, e.target.value)}>
                    {emailDomains.map(domain => <option key={domain} value={domain}>{domain}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="zip-lookup">
              <div className="f">
                <span className="fl">{isJa ? "郵便番号" : "Postal code"}</span>
                <input className="fi" value={zip} onChange={e => setZip(e.target.value)} placeholder="154-0000" inputMode="numeric" />
              </div>
              <button type="button" className="btn" onClick={lookupZip} disabled={lookupState === 'loading'}>
                <I n="sync" s={12} style={{ animation: lookupState === 'loading' ? 'spin 0.6s linear infinite' : 'none' }} />
                {lookupState === 'loading' ? (isJa ? '検索中' : 'Looking up') : (isJa ? '住所検索' : 'Find address')}
              </button>
              {lookupState === 'error' && <small className="field-error">{isJa ? '7桁の郵便番号を確認してください。' : 'Check the 7-digit postal code.'}</small>}
            </div>
            <Inp label={isJa ? "現住所" : "Address (JP)"} name="address" value={d.address} onChange={v => s('address', v)} placeholder="東京都世田谷区" />
          </div>
        </div>

        {/* Online block */}
        <div className="pg-block">
          <div className="pg-block-label">
            <I n="code" s={10} style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.7 }} />
            {isJa ? "オンラインリンク" : "Online"}
          </div>
          <div className="flds">
            <div className="row2">
              <div className="f link-field">
                <span className="fl"><span className="brand-mark linkedin"><LinkedinMark /></span> LinkedIn URL</span>
                <input className={`fi ${linkedinOk ? '' : 'invalid'}`} name="linkedin" value={d.linkedin || ''} onChange={e => s('linkedin', e.target.value)} placeholder="https://linkedin.com/in/username" />
                {!linkedinOk && <small className="field-error">Use a linkedin.com/in profile URL.</small>}
              </div>
              <div className="f link-field">
                <span className="fl"><span className="brand-mark github"><GithubMark /></span> GitHub URL</span>
                <input className={`fi ${githubOk ? '' : 'invalid'}`} name="github" value={d.github || ''} onChange={e => s('github', e.target.value)} placeholder="https://github.com/username" />
                {!githubOk && <small className="field-error">Use a github.com profile URL.</small>}
              </div>
            </div>
          </div>
        </div>

      </div>
    </Sec>
  );
}

/* ── JP Summary ─────────────────────────────────────────── */
export function SummarySec({ data, onChange, isJa, resume }) {
  const makeSummary = () => {
    const p = resume?.personal || {};
    const edu = resume?.education?.[0];
    const skills = resume?.skills || {};
    const skillLine = Array.isArray(skills)
      ? skills.slice(0, 6).join(', ')
      : [skills.languages, skills.frameworks, skills.tools].filter(Boolean).join(', ');
    if (isJa) {
      onChange(`${p.nameJa || p.nameEn || '応募者'}は、${edu?.institutionJa || edu?.institution || '大学'}で${edu?.degreeJa || edu?.degree || '専門分野'}を学び、${skillLine || 'ソフトウェア開発'}に取り組んでいます。実務経験とプロジェクト経験を通じて、課題を整理し、利用者にとって分かりやすい成果物を作ることを重視しています。`);
    } else {
      onChange(`${p.nameEn || p.nameJa || 'Candidate'} is a software-focused student with experience in ${skillLine || 'modern web development'}. Their background combines ${edu?.degree || edu?.degreeJa || 'academic study'} with practical project work, emphasizing clear problem solving, reliable implementation, and user-centered delivery.`);
    }
  };
  return (
    <Sec icon="txt" label={isJa ? "自己紹介" : "Summary"} testId="section-summary-title" open hideHeader>
      <div className="flds flds-mt">
        <div className="section-tools-row">
          <button type="button" className="btn" onClick={makeSummary}>
            <I n="brain" s={12} />
            {isJa ? 'AI下書きを生成' : 'Generate draft'}
          </button>
        </div>
        <Txta
          label={isJa ? "自己紹介・志望動機など" : "Professional Summary"}
          value={data}
          onChange={onChange}
          placeholder={isJa ? "学歴、強み、志望動機を簡潔に入力..." : "Summarize your background, strengths, and target role..."}
          rows={5}
          className="summary-textarea"
        />
      </div>
    </Sec>
  );
}

/* ── Education ──────────────────────────────────────────── */
export function EducationSec({ data, onChange, isJa }) {
  const set = (i, k, v) => onChange(data.map((e, x) => x === i ? { ...e, [k]: v } : e));
  const add = () => onChange([...data, { school: '', schoolJa: '', institution: '', institutionJa: '', location: '', degree: '', degreeJa: '', startDate: '', endDate: '', bullets: [] }]);
  const del = i => onChange(data.filter((_, x) => x !== i));
  const move = (i, dir) => {
    const nextIdx = i + dir;
    if (nextIdx < 0 || nextIdx >= data.length) return;
    const nextData = [...data];
    const temp = nextData[i];
    nextData[i] = nextData[nextIdx];
    nextData[nextIdx] = temp;
    onChange(nextData);
  };

  return (
    <Sec icon="edu" label={isJa ? "学歴" : "Education"} count={data.length} testId="section-education-title" open>
      {data.map((e, i) => {
        const itemLabel = isJa 
          ? (e.schoolJa || e.school || e.institutionJa || `学校 ${i + 1}`)
          : (e.school || e.institution || `School ${i + 1}`);
        return (
          <div key={i} className="item">
            <div className="item-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="item-label">{itemLabel}</span>
              <div className="item-hd-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button 
                  type="button"
                  className="btn-move" 
                  disabled={i === 0} 
                  onClick={() => move(i, -1)} 
                  data-testid={`move-up-education-${i}`}
                  style={{ background: 'none', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.3 : 0.7, padding: '4px 6px', fontSize: '12px' }}
                  title="Move Up"
                >
                  ▲
                </button>
                <button 
                  type="button"
                  className="btn-move" 
                  disabled={i === data.length - 1} 
                  onClick={() => move(i, 1)} 
                  data-testid={`move-down-education-${i}`}
                  style={{ background: 'none', border: 'none', cursor: i === data.length - 1 ? 'not-allowed' : 'pointer', opacity: i === data.length - 1 ? 0.3 : 0.7, padding: '4px 6px', fontSize: '12px' }}
                  title="Move Down"
                >
                  ▼
                </button>
                <button 
                  type="button"
                  className="item-del" 
                  onClick={() => del(i)} 
                  data-testid={`delete-education-${i}`}
                  style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', fontWeight: '500' }}
                >
                  {isJa ? "削除" : "Remove"}
                </button>
              </div>
            </div>
            <div className="flds">
              {isJa ? (
                <>
                  <div className="row2">
                    <SuggestInput label="学校名" name={`education.${i}.school`} value={e.schoolJa || e.school || e.institutionJa} onChange={v => { set(i, 'schoolJa', v); set(i, 'school', v); set(i, 'institution', v); set(i, 'institutionJa', v); }} suggestions={INSTITUTIONS_JA} placeholder="東海大学..." />
                    <SuggestInput label="学部・学科・専攻" name={`education.${i}.degree`} value={e.degreeJa || e.degree} onChange={v => { set(i, 'degreeJa', v); set(i, 'degree', v); }} suggestions={DEGREES_JA} placeholder="情報通信学部 情報通信学科..." />
                  </div>
                  <div className="row3">
                    <SuggestInput label="所在地" name={`education.${i}.location`} value={e.location} onChange={v => set(i, 'location', v)} suggestions={LOCATIONS} placeholder="東京都世田谷区..." />
                    <Inp label="入学年月" name={`education.${i}.startDate`} value={e.startDate} onChange={v => set(i, 'startDate', v)} placeholder="2024-04" />
                    <Inp label="卒業・修了予定年月" name={`education.${i}.endDate`} value={e.endDate} onChange={v => set(i, 'endDate', v)} placeholder="2028-03" />
                  </div>
                </>
              ) : (
                <>
                  <div className="row2">
                    <SuggestInput label="Institution" name={`education.${i}.school`} value={e.school || e.institution} onChange={v => { set(i, 'school', v); set(i, 'institution', v); }} suggestions={INSTITUTIONS_EN} placeholder="Tokai University..." />
                    <SuggestInput label="Degree / Program" name={`education.${i}.degree`} value={e.degree} onChange={v => set(i, 'degree', v)} suggestions={DEGREES_EN} placeholder="Bachelor of Science..." />
                  </div>
                  <div className="row3">
                    <SuggestInput label="Location" name={`education.${i}.location`} value={e.location} onChange={v => set(i, 'location', v)} suggestions={LOCATIONS} placeholder="Tokyo, Japan..." />
                    <Inp label="Start" name={`education.${i}.startDate`} value={e.startDate} onChange={v => set(i, 'startDate', v)} placeholder="Apr 2024" />
                    <Inp label="End" name={`education.${i}.endDate`} value={e.endDate} onChange={v => set(i, 'endDate', v)} placeholder="Mar 2028" />
                  </div>
                </>
              )}
              <Bullets items={e.bullets || []} onChange={b => set(i, 'bullets', b)} />
            </div>
          </div>
        );
      })}
      <button className="btn-add-item" data-testid="add-education" onClick={add}>
        {isJa ? "+ 学歴を追加" : "+ Add education"}
      </button>
    </Sec>
  );
}

/* ── Experience ─────────────────────────────────────────── */
export function ExperienceSec({ data, onChange, isJa }) {
  const set = (i, k, v) => onChange(data.map((e, x) => x === i ? { ...e, [k]: v } : e));
  const add = () => onChange([...data, { company: '', companyJa: '', role: '', roleJa: '', location: '', startDate: '', endDate: '', description: '', bullets: [] }]);
  const del = i => onChange(data.filter((_, x) => x !== i));
  const move = (i, dir) => {
    const nextIdx = i + dir;
    if (nextIdx < 0 || nextIdx >= data.length) return;
    const nextData = [...data];
    const temp = nextData[i];
    nextData[i] = nextData[nextIdx];
    nextData[nextIdx] = temp;
    onChange(nextData);
  };

  return (
    <Sec icon="work" label={isJa ? "職歴" : "Work Experience"} count={data.length} testId="section-experience-title" open>
      {data.map((e, i) => {
        const itemLabel = isJa
          ? (e.companyJa || e.company || `企業 ${i + 1}`)
          : (e.company || `Company ${i + 1}`);
        return (
          <div key={i} className="item">
            <div className="item-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="item-label">{itemLabel}</span>
              <div className="item-hd-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button 
                  type="button"
                  className="btn-move" 
                  disabled={i === 0} 
                  onClick={() => move(i, -1)} 
                  data-testid={`move-up-experience-${i}`}
                  style={{ background: 'none', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.3 : 0.7, padding: '4px 6px', fontSize: '12px' }}
                  title="Move Up"
                >
                  ▲
                </button>
                <button 
                  type="button"
                  className="btn-move" 
                  disabled={i === data.length - 1} 
                  onClick={() => move(i, 1)} 
                  data-testid={`move-down-experience-${i}`}
                  style={{ background: 'none', border: 'none', cursor: i === data.length - 1 ? 'not-allowed' : 'pointer', opacity: i === data.length - 1 ? 0.3 : 0.7, padding: '4px 6px', fontSize: '12px' }}
                  title="Move Down"
                >
                  ▼
                </button>
                <button 
                  type="button"
                  className="item-del" 
                  onClick={() => del(i)} 
                  data-testid={`delete-experience-${i}`}
                  style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', fontWeight: '500' }}
                >
                  {isJa ? "削除" : "Remove"}
                </button>
              </div>
            </div>
            <div className="flds">
              {isJa ? (
                <>
                  <div className="row2">
                    <SuggestInput label="企業・組織名" name={`experience.${i}.company`} value={e.companyJa || e.company} onChange={v => { set(i, 'companyJa', v); set(i, 'company', v); }} suggestions={COMPANIES_JA} placeholder="アルティウスリンク株式会社..." />
                    <SuggestInput label="役職・職種" name={`experience.${i}.role`} value={e.roleJa || e.role} onChange={v => { set(i, 'roleJa', v); set(i, 'role', v); }} suggestions={ROLES_JA} placeholder="技術サポート..." />
                  </div>
                  <div className="row3">
                    <SuggestInput label="所在地" name={`experience.${i}.location`} value={e.location} onChange={v => set(i, 'location', v)} suggestions={LOCATIONS} placeholder="東京都世田谷区..." />
                    <Inp label="開始年月" name={`experience.${i}.startDate`} value={e.startDate} onChange={v => set(i, 'startDate', v)} placeholder="2024-05" />
                    <Inp label="終了年月" name={`experience.${i}.endDate`} value={e.endDate} onChange={v => set(i, 'endDate', v)} placeholder="2025-05" />
                  </div>
                </>
              ) : (
                <>
                  <div className="row2">
                    <SuggestInput label="Company" name={`experience.${i}.company`} value={e.company} onChange={v => set(i, 'company', v)} suggestions={COMPANIES_EN} placeholder="Altius Link..." />
                    <SuggestInput label="Role" name={`experience.${i}.role`} value={e.role} onChange={v => set(i, 'role', v)} suggestions={ROLES_EN} placeholder="Software Engineer..." />
                  </div>
                  <div className="row3">
                    <SuggestInput label="Location" name={`experience.${i}.location`} value={e.location} onChange={v => set(i, 'location', v)} suggestions={LOCATIONS} placeholder="Tokyo, Japan..." />
                    <Inp label="Start" name={`experience.${i}.startDate`} value={e.startDate} onChange={v => set(i, 'startDate', v)} placeholder="Jun 2023" />
                    <Inp label="End" name={`experience.${i}.endDate`} value={e.endDate} onChange={v => set(i, 'endDate', v)} placeholder="Present" />
                  </div>
                </>
              )}
              <Txta 
                label={isJa ? "職務概要・実績" : "Description"} 
                name={`experience.${i}.description`} 
                value={e.description || ''} 
                onChange={v => set(i, 'description', v)} 
                placeholder={isJa ? "具体的な職務内容や実績..." : "Describe your role..."} 
                rows={4} 
              />
              <Bullets items={e.bullets || []} onChange={b => set(i, 'bullets', b)} />
            </div>
          </div>
        );
      })}
      <button className="btn-add-item" data-testid="add-experience" onClick={add}>
        {isJa ? "+ 職歴を追加" : "+ Add experience"}
      </button>
    </Sec>
  );
}

/* ── Projects ───────────────────────────────────────────── */
export function ProjectsSec({ data, onChange, isJa }) {
  const set = (i, k, v) => onChange(data.map((e, x) => x === i ? { ...e, [k]: v } : e));
  const add = () => onChange([...data, { title: '', name: '', tech: '', role: '', year: '', bullets: [] }]);
  const del = i => onChange(data.filter((_, x) => x !== i));
  const move = (i, dir) => {
    const nextIdx = i + dir;
    if (nextIdx < 0 || nextIdx >= data.length) return;
    const nextData = [...data];
    const temp = nextData[i];
    nextData[i] = nextData[nextIdx];
    nextData[nextIdx] = temp;
    onChange(nextData);
  };

  return (
    <Sec icon="code" label={isJa ? "プロジェクト" : "Projects"} count={data.length} testId="section-projects-title" open>
      {data.map((p, i) => {
        const itemLabel = isJa
          ? (p.name || p.title || `プロジェクト ${i + 1}`)
          : (p.title || `Project ${i + 1}`);
        return (
          <div key={i} className="item">
            <div className="item-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="item-label">{itemLabel}</span>
              <div className="item-hd-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button 
                  type="button"
                  className="btn-move" 
                  disabled={i === 0} 
                  onClick={() => move(i, -1)} 
                  data-testid={`move-up-project-${i}`}
                  style={{ background: 'none', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.3 : 0.7, padding: '4px 6px', fontSize: '12px' }}
                  title="Move Up"
                >
                  ▲
                </button>
                <button 
                  type="button"
                  className="btn-move" 
                  disabled={i === data.length - 1} 
                  onClick={() => move(i, 1)} 
                  data-testid={`move-down-project-${i}`}
                  style={{ background: 'none', border: 'none', cursor: i === data.length - 1 ? 'not-allowed' : 'pointer', opacity: i === data.length - 1 ? 0.3 : 0.7, padding: '4px 6px', fontSize: '12px' }}
                  title="Move Down"
                >
                  ▼
                </button>
                <button 
                  type="button"
                  className="item-del" 
                  onClick={() => del(i)} 
                  data-testid={`delete-project-${i}`}
                  style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', fontWeight: '500' }}
                >
                  {isJa ? "削除" : "Remove"}
                </button>
              </div>
            </div>
            <div className="flds">
              {isJa ? (
                <>
                  <div className="row2">
                    <Inp label="プロジェクト名" name={`projects.${i}.name`} value={p.name || p.title} onChange={v => { set(i, 'name', v); set(i, 'title', v); }} placeholder="Tutor-System..." />
                    <SuggestInput label="実施年" name={`projects.${i}.year`} value={p.year} onChange={v => set(i, 'year', v)} suggestions={YEARS} placeholder="2025..." />
                  </div>
                  <TagInput label="役割・使用技術" name={`projects.${i}.role`} value={p.role || p.tech} onChange={v => { set(i, 'role', v); set(i, 'tech', v); }} suggestions={TECH_SUGGESTIONS} placeholder="Select or type technologies..." />
                </>
              ) : (
                <>
                  <div className="row2">
                    <Inp label="Title" name={`projects.${i}.name`} value={p.title || p.name} onChange={v => { set(i, 'title', v); set(i, 'name', v); }} placeholder="Tutor-System..." />
                    <SuggestInput label="Year" name={`projects.${i}.year`} value={p.year} onChange={v => set(i, 'year', v)} suggestions={YEARS} placeholder="2025..." />
                  </div>
                  <TagInput label="Role / Technologies" name={`projects.${i}.role`} value={p.tech || p.role} onChange={v => { set(i, 'tech', v); set(i, 'role', v); }} suggestions={TECH_SUGGESTIONS} placeholder="Select or type technologies..." />
                </>
              )}
              <Bullets items={p.bullets || []} onChange={b => set(i, 'bullets', b)} />
            </div>
          </div>
        );
      })}
      <button className="btn-add-item" data-testid="add-project" onClick={add}>
        {isJa ? "+ プロジェクトを追加" : "+ Add project"}
      </button>
    </Sec>
  );
}

/* ── Activities ─────────────────────────────────────────── */
export function ActivitiesSec({ data, onChange, isJa }) {
  const set = (i, k, v) => onChange(data.map((e, x) => x === i ? { ...e, [k]: v } : e));
  const add = () => onChange([...data, { title: '', org: '', location: '', startDate: '', endDate: '', bullets: [] }]);
  const del = i => onChange(data.filter((_, x) => x !== i));
  const move = (i, dir) => {
    const nextIdx = i + dir;
    if (nextIdx < 0 || nextIdx >= data.length) return;
    const nextData = [...data];
    const temp = nextData[i];
    nextData[i] = nextData[nextIdx];
    nextData[nextIdx] = temp;
    onChange(nextData);
  };

  return (
    <Sec icon="star" label={isJa ? "活動・資格" : "Activities & Certifications"} count={data.length} testId="section-activities-title" open>
      {data.map((a, i) => {
        const itemLabel = isJa
          ? (a.title || `活動・資格 ${i + 1}`)
          : (a.title || `Activity ${i + 1}`);
        return (
          <div key={i} className="item">
            <div className="item-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="item-label">{itemLabel}</span>
              <div className="item-hd-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button 
                  type="button"
                  className="btn-move" 
                  disabled={i === 0} 
                  onClick={() => move(i, -1)} 
                  data-testid={`move-up-activity-${i}`}
                  style={{ background: 'none', border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.3 : 0.7, padding: '4px 6px', fontSize: '12px' }}
                  title="Move Up"
                >
                  ▲
                </button>
                <button 
                  type="button"
                  className="btn-move" 
                  disabled={i === data.length - 1} 
                  onClick={() => move(i, 1)} 
                  data-testid={`move-down-activity-${i}`}
                  style={{ background: 'none', border: 'none', cursor: i === data.length - 1 ? 'not-allowed' : 'pointer', opacity: i === data.length - 1 ? 0.3 : 0.7, padding: '4px 6px', fontSize: '12px' }}
                  title="Move Down"
                >
                  ▼
                </button>
                <button 
                  type="button"
                  className="item-del" 
                  onClick={() => del(i)} 
                  data-testid={`delete-activity-${i}`}
                  style={{ color: 'var(--err)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', fontWeight: '500' }}
                >
                  {isJa ? "削除" : "Remove"}
                </button>
              </div>
            </div>
            <div className="flds">
              {isJa ? (
                <>
                  <div className="row2">
                    <Inp label="資格・活動名" name={`activities.${i}.title`} value={a.title} onChange={v => set(i, 'title', v)} />
                    <Inp label="主催・発行機関" name={`activities.${i}.org`} value={a.org} onChange={v => set(i, 'org', v)} />
                  </div>
                  <div className="row3">
                    <Inp label="場所" name={`activities.${i}.location`} value={a.location} onChange={v => set(i, 'location', v)} />
                    <Inp label="取得・開始年月" name={`activities.${i}.startDate`} value={a.startDate} onChange={v => set(i, 'startDate', v)} />
                    <Inp label="終了・取得予定年月" name={`activities.${i}.endDate`} value={a.endDate} onChange={v => set(i, 'endDate', v)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="row2">
                    <Inp label="Title" name={`activities.${i}.title`} value={a.title} onChange={v => set(i, 'title', v)} />
                    <Inp label="Organization" name={`activities.${i}.org`} value={a.org} onChange={v => set(i, 'org', v)} />
                  </div>
                  <div className="row3">
                    <Inp label="Location" name={`activities.${i}.location`} value={a.location} onChange={v => set(i, 'location', v)} />
                    <Inp label="Start" name={`activities.${i}.startDate`} value={a.startDate} onChange={v => set(i, 'startDate', v)} />
                    <Inp label="End" name={`activities.${i}.endDate`} value={a.endDate} onChange={v => set(i, 'endDate', v)} />
                  </div>
                </>
              )}
              <Bullets items={a.bullets || []} onChange={b => set(i, 'bullets', b)} />
            </div>
          </div>
        );
      })}
      <button className="btn-add-item" data-testid="add-activity" onClick={add}>
        {isJa ? "+ 活動・資格を追加" : "+ Add activity"}
      </button>
    </Sec>
  );
}

/* ── Suggestions lists ──────────────────────────────────── */
export const INSTITUTIONS_EN = [
  "Tokai University",
  "The University of Tokyo",
  "Tokyo Metropolitan University",
  "Tokyo University of Science",
  "Tokyo University of Foreign Studies",
  "Tokyo University of Agriculture and Technology",
  "Tokyo Medical and Dental University",
  "Hitotsubashi University",
  "Ochanomizu University",
  "Gakushuin University",
  "Sophia University",
  "Meiji University",
  "Aoyama Gakuin University",
  "Rikkyo University",
  "Chuo University",
  "Hosei University",
  "Nihon University",
  "Toyo University",
  "Komazawa University",
  "Senshu University",
  "Seikei University",
  "Seijo University",
  "Musashi University",
  "Tokyo Denki University",
  "Tokyo City University",
  "Shibaura Institute of Technology",
  "Kogakuin University",
  "Tokyo Polytechnic University",
  "Digital Hollywood University",
  "Kyoto University",
  "Waseda University",
  "Keio University",
  "Tokyo Institute of Technology",
  "Osaka University",
  "Tohoku University"
];

export const INSTITUTIONS_JA = [
  "東海大学",
  "東京大学",
  "東京都立大学",
  "東京理科大学",
  "東京外国語大学",
  "東京農工大学",
  "東京医科歯科大学",
  "一橋大学",
  "お茶の水女子大学",
  "学習院大学",
  "上智大学",
  "明治大学",
  "青山学院大学",
  "立教大学",
  "中央大学",
  "法政大学",
  "日本大学",
  "東洋大学",
  "駒澤大学",
  "専修大学",
  "成蹊大学",
  "成城大学",
  "武蔵大学",
  "東京電機大学",
  "東京都市大学",
  "芝浦工業大学",
  "工学院大学",
  "東京工芸大学",
  "デジタルハリウッド大学",
  "京都大学",
  "早稲田大学",
  "慶應義塾大学",
  "東京工業大学",
  "大阪大学",
  "東北大学"
];

export const DEGREES_EN = [
  "Bachelor of Science",
  "Bachelor of Engineering",
  "Bachelor of Arts",
  "Master of Science",
  "Master of Engineering",
  "Master of Business Administration (MBA)",
  "Doctor of Philosophy (PhD)",
  "Associate Degree",
  "High School Diploma"
];

export const DEGREES_JA = [
  "学士（理学）",
  "学士（工学）",
  "学士（情報科学）",
  "修士（理学）",
  "修士（工学）",
  "博士（理学）",
  "博士（工学）",
  "高等部卒業"
];

export const COMPANIES_EN = [
  "Altius Link (formerly KDDI Evolva)",
  "Japan Airlines",
  "Hotel SUI Akasaka",
  "Google",
  "Microsoft",
  "Amazon Japan",
  "Apple Japan",
  "Meta Japan",
  "LINEヤフー",
  "Sony",
  "Toyota",
  "Honda",
  "Nissan",
  "Hitachi",
  "Fujitsu",
  "NEC",
  "NTT DATA",
  "Recruit",
  "CyberAgent",
  "DeNA",
  "SoftBank",
  "Rakuten",
  "Mercari"
];

export const COMPANIES_JA = [
  "アルティウスリンク株式会社",
  "日本航空株式会社",
  "ホテルSUI赤坂",
  "グーグル合同会社",
  "日本マイクロソフト株式会社",
  "アマゾンジャパン合同会社",
  "Apple Japan合同会社",
  "Meta Japan株式会社",
  "LINEヤフー株式会社",
  "ソニーグループ株式会社",
  "トヨタ自動車株式会社",
  "本田技研工業株式会社",
  "日産自動車株式会社",
  "株式会社日立製作所",
  "富士通株式会社",
  "日本電気株式会社",
  "株式会社NTTデータ",
  "株式会社リクルート",
  "株式会社サイバーエージェント",
  "株式会社ディー・エヌ・エー",
  "ソフトバンク株式会社",
  "楽天グループ株式会社",
  "株式会社メルカリ"
];

export const ROLES_EN = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Mobile App Developer",
  "iOS Developer",
  "Android Developer",
  "Data Scientist",
  "Machine Learning Engineer",
  "UI/UX Designer",
  "Product Manager",
  "Product Designer",
  "QA Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "Security Engineer",
  "Data Analyst",
  "Technical Support Specialist",
  "Customer Success Associate",
  "Translation Specialist",
  "Research Assistant",
  "English Teacher",
  "Front Desk Associate",
  "Intern"
];

export const ROLES_JA = [
  "ソフトウェアエンジニア",
  "フロントエンドエンジニア",
  "バックエンドエンジニア",
  "フルスタックエンジニア",
  "モバイルアプリエンジニア",
  "iOSデベロッパー",
  "データサイエンティスト",
  "機械学習エンジニア",
  "UI/UXデザイナー",
  "プロダクトマネージャー",
  "プロダクトデザイナー",
  "QAエンジニア",
  "DevOpsエンジニア",
  "クラウドエンジニア",
  "セキュリティエンジニア",
  "データアナリスト",
  "テクニカルサポート",
  "カスタマーサクセス",
  "翻訳スペシャリスト",
  "研究アシスタント",
  "英語講師",
  "フロントアソシエイト",
  "インターン"
];

export const LOCATIONS = [
  "Tokyo, Japan",
  "Kanagawa, Japan",
  "Osaka, Japan",
  "Kyoto, Japan",
  "Remote",
  "Hybrid",
  "San Francisco, CA",
  "New York, NY"
];

export const YEARS = [
  "2026",
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020"
];

/* ── Skills ─────────────────────────────────────────────── */
export const LANGS = ["JavaScript", "TypeScript", "Python", "HTML", "CSS", "C", "C++", "Java", "Swift", "Go", "Rust", "Ruby", "PHP", "SQL", "Shell", "Kotlin", "Dart", "MATLAB", "R", "Scala", "Haskell", "Perl"];
export const TECH_SUGGESTIONS = ["React", "Node.js", "Express", "Next.js", "Vue", "Angular", "Django", "Flask", "FastAPI", "Spring Boot", "Ruby on Rails", "ASP.NET", "Laravel", "SwiftUI", "AppKit", "Tailwind CSS", "Bootstrap", "jQuery", "TensorFlow", "PyTorch", "NumPy", "Pandas", ...LANGS];
export const FRAMEWORKS = ["React", "Node.js", "Express", "Next.js", "Vue", "Angular", "Django", "Flask", "FastAPI", "Spring Boot", "Ruby on Rails", "ASP.NET", "Laravel", "SwiftUI", "AppKit", "Tailwind CSS", "Bootstrap", "jQuery", "TensorFlow", "PyTorch", "NumPy", "Pandas"];
export const TOOLS = ["Git", "GitHub", "GitLab", "Docker", "Kubernetes", "AWS", "Google Cloud", "Azure", "Vercel", "Netlify", "Firebase", "Heroku", "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Oracle", "DynamoDB", "VS Code", "Webpack", "Vite", "npm", "yarn"];
export const CONCEPTS = ["RESTful APIs", "GraphQL", "OOP", "Functional Programming", "Data Structures", "Algorithms", "System Design", "Microservices", "CI/CD", "Agile", "Scrum", "TDD", "Unit Testing", "E2E Testing", "DevOps", "WebRTC", "PWA", "Responsive Design", "MVC", "Serverless"];
export const SPOKEN = ["English (Native)", "English (Professional)", "English (Conversational)", "Japanese (Native)", "Japanese (Business)", "Japanese (JLPT N1)", "Japanese (JLPT N2)", "Japanese (JLPT N3)", "Spanish", "French", "German", "Chinese", "Korean", "Tamil", "Hindi", "Arabic"];

export function SkillsSec({ data, onChange, isJa }) {
  if (Array.isArray(data)) {
    // Flat skills list editor fallback (for E2E tests)
    const [newSkill, setNewSkill] = React.useState('');
    const add = () => {
      if (newSkill.trim() && !data.includes(newSkill.trim())) {
        onChange([...data, newSkill.trim()]);
        setNewSkill('');
      }
    };
    const del = skill => {
      onChange(data.filter(s => s !== skill));
    };
    return (
      <Sec icon="zap" label={isJa ? "スキル" : "Skills"} testId="section-skills-title" open>
        <div className="flds flds-mt">
          <div className="flat-skills-input-row" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input 
              type="text" 
              className="fi" 
              data-testid="new-skill-input" 
              value={newSkill} 
              onChange={e => setNewSkill(e.target.value)} 
              placeholder={isJa ? "新しいスキルを追加..." : "Add a new skill..."} 
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg)', color: 'var(--text)' }}
            />
            <button 
              type="button" 
              className="btn" 
              data-testid="add-skill-btn" 
              onClick={add}
              style={{ padding: '8px 16px', background: 'var(--blue)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isJa ? "追加" : "Add"}
            </button>
          </div>
          <div className="flat-skills-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {data.map((s, idx) => (
              <span 
                key={idx} 
                className="tag-pill" 
                data-testid={`skill-tag-${s}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--b0)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', color: 'var(--t1)' }}
              >
                {s}
                <button 
                  type="button" 
                  data-testid={`delete-skill-${s}`} 
                  onClick={() => del(s)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 0, color: 'var(--t3)' }}
                >
                  <I n="x" s={10} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </Sec>
    );
  }

  // Categorized skills
  const s = (k, v) => onChange({ ...data, [k]: v });
  return (
    <Sec icon="zap" label={isJa ? "スキル" : "Skills"} testId="section-skills-title" open>
      <div className="flds flds-mt skills-selector-grid">
        <TagInput label={isJa ? "プログラミング言語" : "Programming Languages"} value={data.languages} onChange={v => s('languages', v)} suggestions={LANGS} placeholder={isJa ? "選択または入力..." : "Select or type languages..."} />
        <TagInput label={isJa ? "フレームワーク" : "Frameworks & Libraries"} value={data.frameworks} onChange={v => s('frameworks', v)} suggestions={FRAMEWORKS} placeholder={isJa ? "選択または入力..." : "Select or type frameworks..."} />
        <TagInput label={isJa ? "ツール・データベース" : "Tools & Databases"} value={data.tools} onChange={v => s('tools', v)} suggestions={TOOLS} placeholder={isJa ? "選択または入力..." : "Select or type tools/DBs..."} />
        <TagInput label={isJa ? "専門分野・コンセプト" : "Concepts & Methodologies"} value={data.concepts} onChange={v => s('concepts', v)} suggestions={CONCEPTS} placeholder={isJa ? "選択または入力..." : "Select or type concepts..."} />
        <TagInput label={isJa ? "語学" : "Spoken Languages"} value={data.spoken} onChange={v => s('spoken', v)} suggestions={SPOKEN} placeholder={isJa ? "選択または入力..." : "Select or type spoken languages..."} />
      </div>
    </Sec>
  );
}
