import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Globe2,
  LoaderCircle,
  MapPin,
  PlusCircle,
  Search,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { internshipApi, settingsApi } from '../api/client.js';
import { APPLICATION_STATUSES, statusLabel, useApplicationTracker } from '../hooks/useApplicationTracker.js';
import { notifyCatalogChange, useInternshipCatalog } from '../hooks/useInternshipCatalog.js';
import { CompanyLogo } from './CompanyLogo.jsx';
import InterviewDateModal from './InterviewDateModal.jsx';
import { displayCompany, displayRole, displayValue, internshipDetails, splitLanguageRequirement } from '../utils/internshipDisplay.js';
import { appliedCompaniesForProfile, appliedCompanyRank, compareCompanyAwareMatch } from '../utils/internshipRanking.js';

const DESKTOP_PAGE_SIZE = 14;
const MOBILE_PAGE_SIZE = 6;
// Recompute the clock per call (not once at module load) so a tab left open across
// midnight JST still evaluates expiry/urgency against the current time. See BUG-009.
const nowDate = () => new Date();
const todayIso = () => new Date().toISOString().slice(0, 10);
const DISPLAY_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Statuses that mean the user has already engaged the role from the tracker. These
// now live on the dashboard, so the radar hides them entirely. "saved" / untracked
// do not count and keep showing (subject to the deadline-expiry rule below).
const APPLIED_TYPE_STATUSES = new Set(['applying', 'applied', 'interview']);
// Resolve a listing's deadline to a full JST INSTANT. A timed deadline carries an
// "HH:MM JST" suffix (e.g. "2026-06-30 09:00 JST"); otherwise we treat end-of-day
// (23:59:59) in JST. Returns null for "Not stated" listings (no deadlineDate).
const deadlineInstant = item => {
  const date = item?.deadlineDate;
  if (!date) return null;
  const timed = String(item.deadline || '').match(/(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*JST/i);
  if (timed && timed[1] === date) {
    const [, isoDate, hour, minute] = timed;
    return new Date(`${isoDate}T${hour.padStart(2, '0')}:${minute}:00+09:00`);
  }
  return new Date(`${date}T23:59:59+09:00`);
};
const isExpiredDeadline = item => {
  const cutoff = deadlineInstant(item);
  return Boolean(cutoff) && cutoff < nowDate();
};
// Radar visibility rule:
//  1. Applied-type listings (applying/applied/interview) are hidden from the radar
//     entirely — the user tracks those from the dashboard now.
//  2. Remaining listings (saved / untracked) are hidden once their full deadline
//     INSTANT has passed in JST (so a 2026-06-30 09:00 JST deadline is already
//     expired at 2026-07-01 00:00 JST).
//  3. Listings with no deadlineDate ("Not stated") always show (unless applied).
//  4. EXCEPTION: a role the user has "saved" stays visible even after its deadline
//     lapses (rendered with the existing urgent/expired styling) so the Saved filter
//     count always matches the rendered rows. See BUG-007.
const isVisibleInRadar = (item, status) =>
  !APPLIED_TYPE_STATUSES.has(status) && (status === 'saved' || !isExpiredDeadline(item));

const copy = {
  en: {
    title: 'Japan-first internship matches',
    verified: (total, target, date) => `${total} verified live roles · target top ${target} · checked ${date}`,
    tune: 'Tune my resume',
    tokyo: 'Tokyo matches',
    japan: 'Japan total',
    english: 'English-first',
    tracked: 'tracked applications',
    review: 'Review priority list',
    search: 'Search company, role, or keyword',
    filters: 'Filters',
    allLocations: 'All locations',
    allTracks: 'All tracks',
    allLanguages: 'All languages',
    allDeadlines: 'All deadlines',
    allStatuses: 'All statuses',
    next7: 'Next 7 days',
    next30: 'Next 30 days',
    notStated: 'Not stated',
    priority: 'Priority',
    saved: count => `Saved (${count})`,
    clear: 'Clear all',
    sort: 'Sort',
    sortJapan: 'Tokyo priority',
    sortMatch: 'Best match',
    sortDeadline: 'Deadline',
    sortCompany: 'Company A-Z',
    rank: 'Rank',
    companyRole: 'Company & role',
    match: 'Match',
    location: 'Location',
    language: 'Language',
    duration: 'Duration',
    deadline: 'Deadline',
    status: 'Status',
    apply: 'Apply',
    applyNow: 'Apply now',
    about: 'What the internship is about',
    fitHeading: 'Why this is a strong fit',
    techStack: 'Tech stack / likely tools',
    eligibility: 'Eligibility check',
    process: 'Application procedure',
    source: 'Research source',
    compensation: 'Compensation',
    verifiedSmall: date => `Link verified ${date || todayIso()}. Openings can close without notice.`,
    noMatches: 'No internships match these filters',
    noMatchesSub: 'Clear a filter or search another technology.',
    reset: 'Reset filters',
    liveSearchTitle: company => `Search live internships at ${company}`,
    liveSearchSub: 'Live research checks official company and ATS pages. Most searches finish in 30–90 seconds and repeat searches reuse recent results.',
    liveSearching: company => `Researching ${company}…`,
    liveDone: count => count ? `${count} verified opening${count === 1 ? '' : 's'} found` : 'No currently available internship found on official sources.',
    liveError: 'Company research failed. Try again in a moment.',
    liveStart: 'Search official sources',
    liveAdd: 'Add to matches',
    liveAdded: 'Added',
    liveKeyMissing: 'Live research needs an OpenRouter API key.',
    liveAddKey: 'Add your key in Settings',
    liveNoCoding: 'Coding test not published',
    showing: (start, end, total) => `Showing ${start}-${end} of ${total}`,
    page: (page, count) => `Page ${page} of ${count}`,
    summaryLabel: 'Internship research summary',
    detailLabel: company => `${company} internship details`,
    saveLabel: (company, saved) => `${saved ? 'Remove' : 'Save'} ${company} internship`,
    previousPage: 'Previous page',
    nextPage: 'Next page',
    disclaimer: 'Research is a point-in-time shortlist, not an offer of eligibility. Re-check dates, student status, and visa/work-authorization terms on the employer page before applying.',
    track: 'Track',
    notTracked: 'Not tracked',
    close: 'Close details',
    matchLabel: score => score >= 90 ? 'Excellent' : score >= 85 ? 'Very strong' : score >= 80 ? 'Strong' : 'Worth exploring',
  },
  ja: {
    title: '日本優先インターン検索',
    verified: (total, target, date) => `${total}件の確認済み募集 · 目標上位${target}件 · 確認日 ${date}`,
    tune: '履歴書を調整',
    tokyo: '東京の募集',
    japan: '日本の募集',
    english: '英語中心',
    tracked: '管理中の応募',
    review: '優先リストを見る',
    search: '企業名・職種・キーワードで検索',
    filters: '絞り込み',
    allLocations: 'すべての地域',
    allTracks: 'すべての職種',
    allLanguages: 'すべての言語',
    allDeadlines: 'すべての締切',
    allStatuses: 'すべての状況',
    next7: '7日以内',
    next30: '30日以内',
    notStated: '記載なし',
    priority: '優先',
    saved: count => `保存済み (${count})`,
    clear: '条件をリセット',
    sort: '並び替え',
    sortJapan: '東京優先',
    sortMatch: '適合度順',
    sortDeadline: '締切順',
    sortCompany: '企業名順',
    rank: '順位',
    companyRole: '企業・職種',
    match: '適合度',
    location: '場所',
    language: '言語',
    duration: '期間',
    deadline: '締切',
    status: '状況',
    apply: '応募',
    applyNow: '応募ページへ',
    about: 'インターン内容',
    fitHeading: 'マッチする理由',
    techStack: '使用技術・想定スタック',
    eligibility: '応募条件の確認',
    process: '応募フロー',
    source: '情報源',
    compensation: '待遇',
    verifiedSmall: date => `リンク確認日: ${date || todayIso()}。募集は予告なく終了する場合があります。`,
    noMatches: '条件に合う募集がありません',
    noMatchesSub: '条件を減らすか、別のキーワードで検索してください。',
    reset: '条件をリセット',
    liveSearchTitle: company => `${company}の募集を公式情報で検索`,
    liveSearchSub: '企業公式ページとATSをライブ検索します。通常30〜90秒で完了し、直近の同一検索は結果を再利用します。',
    liveSearching: company => `${company}を調査中…`,
    liveDone: count => count ? `${count}件の確認済み募集が見つかりました` : '公式情報では現在応募可能なインターンは見つかりませんでした。',
    liveError: '企業検索に失敗しました。少し後でもう一度試してください。',
    liveStart: '公式情報を検索',
    liveAdd: '候補に追加',
    liveAdded: '追加済み',
    liveKeyMissing: 'ライブリサーチには OpenRouter APIキーが必要です。',
    liveAddKey: '設定でキーを追加',
    liveNoCoding: 'コーディングテスト未掲載',
    showing: (start, end, total) => `${total}件中 ${start}-${end}件を表示`,
    page: (page, count) => `${page}/${count}ページ`,
    summaryLabel: 'インターン調査サマリー',
    detailLabel: company => `${company}のインターン詳細`,
    saveLabel: (company, saved) => saved ? `${company}を保存済みから削除` : `${company}を保存`,
    previousPage: '前のページ',
    nextPage: '次のページ',
    disclaimer: 'このリストは調査時点の候補です。応募前に企業ページで締切、学生条件、ビザ・就労条件を必ず確認してください。',
    track: '管理',
    notTracked: '未管理',
    close: '詳細を閉じる',
    matchLabel: score => score >= 90 ? '非常に高い' : score >= 85 ? '高い' : score >= 80 ? '良い' : '検討候補',
  },
};

// Urgency styling shares the SAME JST-instant semantics as visibility (deadlineInstant
// + nowDate()), so the badge and the auto-hide rule never disagree about whether a
// deadline has effectively passed. "Not stated" listings carry no urgency class.
const deadlineClass = item => {
  const cutoff = deadlineInstant(item);
  if (!cutoff) return '';
  const days = Math.ceil((cutoff - nowDate()) / 86400000);
  return days <= 7 ? 'urgent' : days <= 21 ? 'soon' : '';
};

const locationPriority = item => {
  if (/Tokyo|東京/i.test(item.location)) return 0;
  if (item.region === 'Japan' || item.country === 'Japan') return 1;
  if (isRemoteRole(item)) return 2;
  if (item.region === 'APAC') return 3;
  return 4;
};

const JA_TRACK_LABELS = {
  'Frontend': 'フロントエンド',
  'Full-stack / Cloud': 'フルスタック / クラウド',
  'Full-stack / AI Applications': 'フルスタック / AIアプリ',
  'Backend / Cloud': 'バックエンド / クラウド',
  'AI/ML Engineering': 'AI・MLエンジニアリング',
  'Software Engineering': 'ソフトウェアエンジニアリング',
  'Infrastructure / Cloud': 'インフラ / クラウド',
  'Backend / Payments': 'バックエンド / 決済',
  'Cloud Infrastructure': 'クラウドインフラ',
  'Data Engineering / Data Science': 'データエンジニアリング / データサイエンス',
  'Network / Infrastructure Automation': 'ネットワーク / インフラ自動化',
  'Enterprise Applications': 'エンタープライズアプリ',
  'Platform Engineering': 'プラットフォームエンジニアリング',
  'Quality Engineering': '品質エンジニアリング',
  'Data Engineering': 'データエンジニアリング',
  'Technical Product Management': 'テクニカルPM',
  'Machine Learning': '機械学習',
  'Machine Learning / Platform': '機械学習 / プラットフォーム',
  'Security Engineering': 'セキュリティエンジニアリング',
  'Systems / Graphics': 'システム / グラフィックス',
  'Systems / AI Hardware': 'システム / AIハードウェア',
  'Python / Mission Operations': 'Python / ミッション運用',
  'Python / Test Infrastructure': 'Python / テスト基盤',
  'Enterprise Architecture / Cloud': 'エンタープライズアーキテクチャ / クラウド',
  'Full-stack / Ad Technology': 'フルスタック / 広告技術',
  'Product Design / UI Engineering': 'プロダクトデザイン / UIエンジニアリング',
  'AI Product / Business Operations': 'AIプロダクト / 事業運用',
  'Cloud / Networking / Security': 'クラウド / ネットワーク / セキュリティ',
  'AI / Machine Learning': 'AI / 機械学習',
  'Frontend / Full-stack': 'フロントエンド / フルスタック',
  'Embedded Software': '組込みソフトウェア',
  'Product / Technical Operations': 'プロダクト / 技術運用',
  'Data': 'データ',
  'Sales / Business': 'セールス / ビジネス',
  'Sales': 'セールス',
  'Mobile Engineering': 'モバイルエンジニアリング',
  'Product Engineering': 'プロダクトエンジニアリング',
};

const trackLabel = (value, isJa) => isJa ? (JA_TRACK_LABELS[value] || value) : value;
const formatVerifiedDate = (date, isJa) => {
  if (!date) return todayIso();
  if (isJa) return date;
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return DISPLAY_DATE_FORMAT.format(parsed);
};

const splitRole = role => {
  const [lead, ...rest] = String(role || '').split(/\s[-–—]\s/);
  if (!rest.length) return [String(role || '').trim()];
  const detail = rest.join(' – ').trim();
  const detailParts = detail.includes('、')
    ? detail.split(/、\s*/).map(part => part.trim()).filter(Boolean)
    : detail.length > 30
    ? detail.split(/,\s+(?=[A-Z])/).map(part => part.trim()).filter(Boolean)
    : [detail];
  return [lead.trim(), ...detailParts];
};

const splitLocation = (value, isJa) => String(displayValue(value, isJa) || '')
  .split(/\s*(?:\/|\|)\s*/)
  .map(part => part.trim())
  .filter(Boolean)
  .map(part => isJa ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`);

const formatDeadline = (value, isJa) => String(displayValue(value, isJa) || '')
  .replace(/\s+JST\b/gi, '')
  .trim();

const fitNoteDisplay = (item, isJa) => {
  if (!isJa) return item.fitNote;
  const field = JA_TRACK_LABELS[item.track] || '専門分野';
  return `${field}に関するスキルとプロジェクト経験が募集要件に合っています。`;
};

const reasonDisplay = (reason, isJa) => {
  if (!isJa) return reason;
  const text = String(reason || '');
  const rules = [
    [/React|TypeScript|JavaScript/i, 'React・TypeScript・JavaScriptの経験を活かせる'],
    [/Python|Java|Go|Swift/i, 'プログラミング言語の実装経験を活かせる'],
    [/AWS|cloud|Docker|Linux/i, 'クラウド・Docker・Linuxの経験を活かせる'],
    [/SQL|database|data structure/i, 'SQL・データベース・データ構造の知識が合う'],
    [/network|infrastructure/i, 'ネットワーク・インフラの学習経験が合う'],
    [/security/i, 'セキュリティ分野の経験と関心が合う'],
    [/English|Japanese|bilingual|cross-cultural/i, '英語・日本語を使った協働経験を活かせる'],
    [/mobile|UI|UX|design/i, 'モバイル・UI/UXの制作実績を示せる'],
    [/AI|machine learning/i, 'AI・機械学習プロジェクトの経験を活かせる'],
    [/product|project|customer/i, 'プロダクト開発と利用者視点の経験が合う'],
  ];
  return rules.find(([pattern]) => pattern.test(text))?.[1] || 'プロジェクト経験と募集要件に共通点がある';
};

const splitDuration = (value, isJa) => {
  const formatted = String(displayValue(value, isJa) || '');
  if (!formatted) return [];
  if (isJa) return formatted.split(/[、,]\s*|・(?=1年|週|2026年|\d)/).filter(Boolean);
  return formatted.split(/[,;]\s*/).filter(Boolean);
};

const normalizeCompanyQuery = value => String(value || '').trim().replace(/\s+/g, ' ');
const isCompanyResearchQuery = value => {
  const query = normalizeCompanyQuery(value);
  return query.length >= 2
    && query.length <= 80
    && /^[\p{L}\p{N}&.' -]+$/u.test(query);
};
const codingTestLabel = (value, isJa, fallback) => {
  if (value === 'required') return isJa ? 'コーディングテストあり' : 'Coding test stated';
  if (value === 'not_required') return isJa ? 'コーディングテストなしと記載' : 'No coding test stated';
  return fallback;
};

const isJapanBased = item => item.region === 'Japan'
  || item.country === 'Japan'
  || /\b(?:Japan|Tokyo|Osaka|Kyoto|Yokohama|Fukuoka|Nagoya|日本|東京|大阪|京都)\b/i.test(`${item.location || ''} ${item.city || ''}`);
const isRemoteRole = item => /remote|リモート/i.test(`${item.location || ''} ${item.workMode || ''}`);
const DetailPanel = ({ item, status, onStatus, onApply, onClose, onOpenEditor, isJa = false }) => {
  const t = copy[isJa ? 'ja' : 'en'];
  const details = internshipDetails(item);
  const companyName = displayCompany(item, isJa);
  const eligibility = isJa ? details.eligibilityJa : details.eligibility;
  const process = isJa ? details.processJa : details.process;
  const [roleLead, ...roleDetails] = splitRole(displayRole(item.role, isJa));
  const languageParts = splitLanguageRequirement(item.language, isJa);
  const durationParts = splitDuration(item.duration, isJa);
  const locationParts = splitLocation(item.location, isJa);
  return (
  <aside className="intern-detail drawer" role="dialog" aria-modal="true" aria-label={t.detailLabel(companyName)}>
    <div className="intern-detail-head">
      <CompanyLogo item={item} size="lg" />
      <div className="intern-detail-title">
        <strong>{companyName}</strong>
        <p className="intern-role-stack"><span>{roleLead}</span>{roleDetails.map((part, i) => <span key={`${part}-${i}`}>{part}</span>)}</p>
      </div>
      <div className="intern-detail-score">
        <b>{item.score}%</b>
        <span>{t.matchLabel(item.score)}</span>
      </div>
      <button type="button" className="icon-button intern-detail-close" onClick={onClose} aria-label={t.close}><X size={17} /></button>
    </div>

    <div className="intern-detail-meta" aria-label={isJa ? '募集条件' : 'Internship facts'}>
      {locationParts.map((part, index) => <span className="intern-meta-token" key={`${part}-${index}`}>{index === 0 ? <MapPin size={13} /> : null}{part}</span>)}
      {languageParts.map((part, index) => <span className="intern-meta-token language" key={`${part}-${index}`}><b>{index === 0 ? 'EN' : 'JA'}</b>{part}</span>)}
      {durationParts.map((part, index) => <span className="intern-meta-token" key={`${part}-${index}`}>{index === 0 ? <CalendarClock size={13} /> : null}{part}</span>)}
    </div>

    {(details.about || details.aboutJa) && (
      <section className="intern-detail-section">
        <h3>{t.about}</h3>
        <p className="intern-fit-note">{displayValue(isJa ? details.aboutJa : details.about, isJa)}</p>
      </section>
    )}

    <section className="intern-detail-section">
      <h3>{t.fitHeading}</h3>
      <p className="intern-fit-note">{fitNoteDisplay(item, isJa)}</p>
      <ul className="intern-reasons">
        {(item.reasons || []).map((reason, index) => <li key={`${reason}-${index}`}><span><Check size={13} /></span>{reasonDisplay(reason, isJa)}</li>)}
      </ul>
    </section>

    {details.techStack.length > 0 && (
      <section className="intern-detail-section">
        <h3>{t.techStack}</h3>
        <div className="intern-chip-list">
          {details.techStack.map((tech, index) => <span key={`${tech}-${index}`}>{displayValue(tech, isJa)}</span>)}
        </div>
      </section>
    )}

    {eligibility.length > 0 && (
      <section className="intern-detail-section intern-eligibility">
        <h3>{t.eligibility}</h3>
        <ul className="intern-check-list">
          {eligibility.map((entry, index) => <li key={`${entry}-${index}`}><ShieldCheck size={15} />{displayValue(entry, isJa)}</li>)}
        </ul>
      </section>
    )}

    <section className="intern-detail-section">
      <h3>{t.process}</h3>
      <ol className="intern-process-list">
        {process.map((step, index) => <li key={`${step}-${index}`}>{displayValue(step, isJa)}</li>)}
      </ol>
    </section>

    <section className="intern-detail-section intern-source">
      <div><span>{t.deadline}</span><strong>{formatDeadline(item.deadline, isJa)}</strong></div>
      <div><span>{t.compensation}</span><strong>{displayValue(item.compensation, isJa)}</strong></div>
      <div><span>{t.source}</span><strong>{displayValue(item.source, isJa)}</strong></div>
      <small>{t.verifiedSmall(item.verifiedDate)}</small>
    </section>

    <div className="intern-detail-actions">
      <a className="intern-apply intern-apply-large" href={item.url} target="_blank" rel="noreferrer" onClick={() => onApply(item)}>
        {copy[isJa ? 'ja' : 'en'].applyNow} <ExternalLink size={15} />
      </a>
      <button type="button" className="intern-save-large" onClick={onOpenEditor}>{t.tune} <ArrowUpRight size={15} /></button>
      <label className="intern-status-control"><span>{t.status}</span><select value={status} onChange={event => onStatus(item, event.target.value)}><option value="">{t.notTracked}</option>{APPLICATION_STATUSES.map(option => <option key={option.value} value={option.value}>{statusLabel(option.value, isJa)}</option>)}</select></label>
    </div>
  </aside>
  );
};

function CompanyResearchPanel({ company, t, isJa, job, results, error, onStart, onAdd, addedIds, addingId, onOpenSettings }) {
  if (!company) return null;
  const searching = job?.status === 'researching';
  const complete = job?.status === 'complete';
  const missingKey = job?.errorCode === 'OPENROUTER_API_KEY_MISSING';
  const showPrompt = !job && !results.length && !error;

  return (
    <section className="company-research-panel" aria-live="polite" data-testid="company-research-panel">
      <div className="company-research-intro">
        {/* No fabricated URL — let CompanyLogo resolve a known domain or show initials
            until real research results (which carry companyDomain) arrive. */}
        <CompanyLogo item={{ company }} />
        <div>
          <h3>{t.liveSearchTitle(company)}</h3>
          <p data-testid="company-research-status">{showPrompt ? t.liveSearchSub : searching ? t.liveSearching(company) : missingKey ? t.liveKeyMissing : error ? `${t.liveError} ${error}` : t.liveDone(results.length)}</p>
        </div>
        {missingKey ? (
          <button type="button" className="company-research-cta" data-testid="company-research-add-key" onClick={onOpenSettings}>
            <PlusCircle size={15} /> {t.liveAddKey}
          </button>
        ) : (
          <button type="button" onClick={onStart} disabled={searching}>
            {searching ? <LoaderCircle size={15} className="spin" /> : <Search size={15} />}
            {searching ? (isJa ? '検索中' : 'Searching') : t.liveStart}
          </button>
        )}
      </div>

      {results.length ? (
        <div className="company-research-results">
          {results.map(result => {
            const added = addedIds.has(result.id);
            return (
              <article key={result.id} className="company-research-result">
                <CompanyLogo item={result} />
                <div>
                  <strong>{displayCompany(result, isJa)}</strong>
                  <span>{displayRole(result.role, isJa)}</span>
                  <small>{displayValue(result.location, isJa)} · {displayValue(result.duration, isJa)} · {codingTestLabel(result.codingTest, isJa, t.liveNoCoding)}</small>
                </div>
                <a href={result.url} target="_blank" rel="noreferrer">{isJa ? '確認' : 'View'} <ExternalLink size={13} /></a>
                <button type="button" onClick={() => onAdd(result)} disabled={added || addingId === result.id}>
                  {addingId === result.id ? <LoaderCircle size={14} className="spin" /> : added ? <Check size={14} /> : <PlusCircle size={14} />}
                  {added ? t.liveAdded : t.liveAdd}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function InternshipDashboard({ isJa, onOpenEditor, onOpenSettings, activeProfile, resume }) {
  const t = isJa ? copy.ja : copy.en;
  const { records, statusFor, updateStatus, addMilestone } = useApplicationTracker(activeProfile);
  const { catalog, meta, refresh: refreshCatalog } = useInternshipCatalog();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('All');
  const [track, setTrack] = useState('All');
  const [language, setLanguage] = useState('All');
  const [deadlineFilter, setDeadlineFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sort, setSort] = useState('japan');
  const [priorityOnly, setPriorityOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => window.innerWidth <= 860 ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE);
  const [researchJob, setResearchJob] = useState(null);
  const [researchResults, setResearchResults] = useState([]);
  const [researchError, setResearchError] = useState('');
  const [addedResearchIds, setAddedResearchIds] = useState(() => new Set());
  const [addingId, setAddingId] = useState('');
  const [interviewTarget, setInterviewTarget] = useState(null);
  const autoResearchStarted = useRef(new Set());

  const eligibleCatalog = catalog;
  // The post-filter visible set: applied-type listings and time-expired listings are
  // removed up front so they drop out of the table AND of everything derived below —
  // the summary stat cards (dynamicStats), the track filter options, and the
  // live-search gating — keeping every count consistent with what's actually shown.
  const visibleCatalog = useMemo(
    () => eligibleCatalog.filter(item => isVisibleInRadar(item, statusFor(item.id))),
    [eligibleCatalog, statusFor],
  );
  const appliedCompanies = useMemo(
    () => appliedCompaniesForProfile(activeProfile, records),
    [activeProfile, records],
  );
  const regions = ['All', 'Japan', 'Remote', 'Global'];
  const tracks = useMemo(() => ['All', ...new Set(visibleCatalog.map(item => item.track).filter(Boolean))], [visibleCatalog]);
  // Derive from the VISIBLE set (not raw tracker records) so the Saved button count
  // always equals the number of rows the Saved filter renders. A saved role that was
  // retired from the catalog is not in visibleCatalog, so it is excluded from both. BUG-007.
  const savedCount = useMemo(
    () => visibleCatalog.filter(item => statusFor(item.id) === 'saved').length,
    [visibleCatalog, statusFor],
  );
  const dynamicStats = useMemo(() => ({
    total: visibleCatalog.length,
    target: Math.max(meta.target || 200, visibleCatalog.length),
    tokyo: visibleCatalog.filter(item => /Tokyo|東京/i.test(item.location)).length,
    japan: visibleCatalog.filter(isJapanBased).length,
    englishFirst: visibleCatalog.filter(item => item.languageType === 'English-first').length,
  }), [visibleCatalog, meta.target]);
  const latestVerifiedDate = useMemo(() => {
    const dates = catalog
      .map(item => item.verifiedDate)
      .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date || ''))
      .sort();
    return dates.at(-1) || meta.researchDate;
  }, [catalog, meta.researchDate]);
  const companyQuery = normalizeCompanyQuery(query);
  const hasCatalogTextMatch = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return false;
    return visibleCatalog.some(item => [item.company, item.role, item.track].join(' ').toLowerCase().includes(needle));
  }, [visibleCatalog, query]);
  const canLiveSearchCompany = isCompanyResearchQuery(companyQuery) && !hasCatalogTextMatch;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = visibleCatalog.filter(item => {
      const status = statusFor(item.id);
      const haystack = [item.company, item.role, item.location, item.track, item.language, item.codingTest, ...(item.reasons || [])].join(' ').toLowerCase();
      return (!needle || haystack.includes(needle))
        && (region === 'All'
          || (region === 'Japan' ? isJapanBased(item)
            : region === 'Remote' ? isRemoteRole(item)
            : !isJapanBased(item) && !isRemoteRole(item)))
        && (track === 'All' || item.track === track)
        && (language === 'All' || item.languageType === language)
        && (statusFilter === 'All' || status === statusFilter)
        && (deadlineFilter === 'All'
          || (deadlineFilter === 'Not stated' && !item.deadlineDate)
          || (deadlineFilter === '7 days' && item.deadlineDate && item.deadlineDate <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
          || (deadlineFilter === '30 days' && item.deadlineDate && item.deadlineDate <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)))
        && (!priorityOnly || item.priority)
        && (!savedOnly || status === 'saved');
    });
    return [...next].sort((a, b) => {
      if (sort === 'deadline') {
        if (!a.deadlineDate && !b.deadlineDate) return b.score - a.score;
        if (!a.deadlineDate) return 1;
        if (!b.deadlineDate) return -1;
        return a.deadlineDate.localeCompare(b.deadlineDate);
      }
      if (sort === 'company') return a.company.localeCompare(b.company);
      if (sort === 'match') return compareCompanyAwareMatch(a, b, appliedCompanies);
      const priorityDelta = locationPriority(a) - locationPriority(b);
      return priorityDelta
        || appliedCompanyRank(a, appliedCompanies) - appliedCompanyRank(b, appliedCompanies)
        || Number(Boolean(b.priority)) - Number(Boolean(a.priority))
        || b.score - a.score;
    });
  }, [visibleCatalog, query, region, track, language, deadlineFilter, statusFilter, sort, priorityOnly, savedOnly, statusFor, appliedCompanies]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selected = selectedId ? catalog.find(item => item.id === selectedId) : null;

  useEffect(() => { setPage(1); }, [query, region, track, language, deadlineFilter, statusFilter, sort, priorityOnly, savedOnly]);
  useEffect(() => {
    const syncPageSize = () => setPageSize(window.innerWidth <= 860 ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE);
    window.addEventListener('resize', syncPageSize);
    return () => window.removeEventListener('resize', syncPageSize);
  }, []);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => {
    if (selectedId && !filtered.some(item => item.id === selectedId)) setSelectedId('');
  }, [filtered, selectedId]);
  useEffect(() => {
    if (!selectedId) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setSelectedId(''); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedId]);

  const startCompanyResearch = async (company = companyQuery, options = {}) => {
    const cleanCompany = normalizeCompanyQuery(company);
    if (!isCompanyResearchQuery(cleanCompany)) return;
    if (researchJob?.status === 'researching' && researchJob.company === cleanCompany) return;
    setResearchError('');
    setResearchResults([]);
    try {
      // Fetch the AI settings fresh at start time so a key just saved in Settings is
      // used immediately, and send the résumé + key/model so the server can research
      // with the user's own OpenRouter key (env fallback). Phase 3 / ADR-0016.
      const settings = await settingsApi.get().catch(() => ({}));
      const job = await internshipApi.startResearch(cleanCompany, activeProfile, {
        resume,
        apiKey: settings?.openrouterKey || undefined,
        searchModel: settings?.searchModel || undefined,
      });
      setResearchJob(job);
      if (job.status === 'complete') setResearchResults(Array.isArray(job.results) ? job.results : []);
      if (options.auto) autoResearchStarted.current.add(cleanCompany.toLowerCase());
    } catch (error) {
      setResearchError(error.message || t.liveError);
      setResearchJob(null);
    }
  };

  useEffect(() => {
    if (!researchJob?.jobId || researchJob.status !== 'researching') return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const job = await internshipApi.researchStatus(researchJob.jobId);
        if (cancelled) return;
        setResearchJob(job);
        if (job.status === 'complete') setResearchResults(Array.isArray(job.results) ? job.results : []);
        if (job.status === 'error') setResearchError(job.error || t.liveError);
      } catch (error) {
        if (!cancelled) {
          setResearchError(error.message || t.liveError);
          setResearchJob(current => current ? { ...current, status: 'error' } : null);
        }
      }
    };
    const timer = window.setInterval(poll, 1500);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [researchJob?.jobId, researchJob?.status, t]);

  useEffect(() => {
    const key = companyQuery.toLowerCase();
    if (!canLiveSearchCompany || autoResearchStarted.current.has(key)) return undefined;
    const timer = window.setTimeout(() => startCompanyResearch(companyQuery, { auto: true }), 1100);
    return () => window.clearTimeout(timer);
  }, [canLiveSearchCompany, companyQuery]);

  const addResearchResult = async item => {
    setAddingId(item.id);
    try {
      const payload = await internshipApi.add(item);
      const addedItem = payload.internship || item;
      setAddedResearchIds(current => new Set([...current, item.id, addedItem.id]));
      await refreshCatalog();
      notifyCatalogChange();
      setSelectedId(addedItem.id);
    } catch (error) {
      setResearchError(error.message || t.liveError);
    } finally {
      setAddingId('');
    }
  };

  const onApply = item => {
    const current = statusFor(item.id);
    if (!current || current === 'saved') updateStatus(item, 'applying');
  };
  const toggleSaved = item => updateStatus(item, statusFor(item.id) === 'saved' ? '' : 'saved');
  // Choosing "Interview" defers the status write until the user supplies a date in the
  // shared modal; every other status change applies immediately as before.
  const handleStatusSelect = (item, status) => {
    if (status === 'interview') {
      setInterviewTarget(item);
      return;
    }
    updateStatus(item, status);
  };
  const confirmInterviewDate = value => {
    if (!interviewTarget) return;
    const [date, time] = String(value || '').trim().split(/[ T]/);
    updateStatus(interviewTarget, 'interview');
    addMilestone(interviewTarget.id, { kind: 'interview', date, time: time || null });
    setInterviewTarget(null);
  };
  const reviewPriorities = () => {
    setPriorityOnly(true);
    setSavedOnly(false);
    document.querySelector('.intern-toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const clearFilters = () => {
    setQuery(''); setRegion('All'); setTrack('All'); setLanguage('All'); setDeadlineFilter('All'); setStatusFilter('All'); setPriorityOnly(false); setSavedOnly(false); setSort('japan');
  };

  const hasFilters = Boolean(query || region !== 'All' || track !== 'All' || language !== 'All' || deadlineFilter !== 'All' || statusFilter !== 'All' || priorityOnly || savedOnly);
  const start = filtered.length ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, filtered.length);

  return (
    <main className={`internship-radar ${isJa ? 'ja' : 'en'}`}>
      <section className="intern-heading">
        <div><h1>{t.title}</h1><p><ShieldCheck size={16} /> {t.verified(dynamicStats.total, dynamicStats.target, formatVerifiedDate(latestVerifiedDate, isJa))}</p></div>
        <button type="button" className="intern-editor-link" onClick={onOpenEditor}>{t.tune} <ArrowUpRight size={15} /></button>
      </section>

      <section className="intern-summary" aria-label={t.summaryLabel}>
        <div><MapPin size={20} /><strong>{dynamicStats.tokyo}</strong><span>{t.tokyo}</span></div>
        <div><Star size={20} /><strong>{dynamicStats.japan}</strong><span>{t.japan}</span></div>
        <div><Globe2 size={20} /><strong>{dynamicStats.englishFirst}</strong><span>{t.english}</span></div>
        <div><BriefcaseBusiness size={20} /><strong>{records.length}</strong><span>{t.tracked}</span></div>
        <button type="button" onClick={reviewPriorities}>{t.review} <ChevronRight size={17} /></button>
      </section>

      <section className="intern-workspace">
        <div className="intern-toolbar">
          <label className="intern-search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />{query ? <button type="button" onClick={() => setQuery('')} aria-label={t.clear}><X size={15} /></button> : null}</label>
          <div className="intern-filter-row">
            <span className="intern-filter-label"><Filter size={15} /> {t.filters}</span>
            <select value={region} onChange={event => setRegion(event.target.value)} aria-label={t.allLocations}>{regions.map(option => <option key={option} value={option}>{option === 'All' ? t.allLocations : option === 'Japan' ? (isJa ? '日本' : 'Japan') : option === 'Remote' ? (isJa ? 'リモート' : 'Remote') : (isJa ? 'グローバル' : 'Global')}</option>)}</select>
            <select value={track} onChange={event => setTrack(event.target.value)} aria-label={t.allTracks}>{tracks.map(option => <option key={option} value={option}>{option === 'All' ? t.allTracks : trackLabel(option, isJa)}</option>)}</select>
            <select value={language} onChange={event => setLanguage(event.target.value)} aria-label={t.allLanguages}><option value="All">{t.allLanguages}</option><option value="English-first">{t.english}</option><option value="Bilingual">{isJa ? 'バイリンガル' : 'Bilingual'}</option></select>
            <select value={deadlineFilter} onChange={event => setDeadlineFilter(event.target.value)} aria-label={t.allDeadlines}><option value="All">{t.allDeadlines}</option><option value="7 days">{t.next7}</option><option value="30 days">{t.next30}</option><option value="Not stated">{t.notStated}</option></select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label={t.allStatuses}><option value="All">{t.allStatuses}</option>{APPLICATION_STATUSES.filter(option => !APPLIED_TYPE_STATUSES.has(option.value)).map(option => <option key={option.value} value={option.value}>{statusLabel(option.value, isJa)}</option>)}</select>
            <button type="button" className={priorityOnly ? 'active' : ''} onClick={() => setPriorityOnly(value => !value)}><Star size={14} /> {t.priority}</button>
            <button type="button" className={savedOnly ? 'active' : ''} onClick={() => setSavedOnly(value => !value)}><Bookmark size={14} /> {t.saved(savedCount)}</button>
            {hasFilters ? <button type="button" className="intern-clear" onClick={clearFilters}>{t.clear}</button> : null}
          </div>
          <label className="intern-sort"><span>{t.sort}</span><select value={sort} onChange={event => setSort(event.target.value)} aria-label={t.sort}><option value="japan">{t.sortJapan}</option><option value="match">{t.sortMatch}</option><option value="deadline">{t.sortDeadline}</option><option value="company">{t.sortCompany}</option></select></label>
        </div>

        {canLiveSearchCompany ? (
          <CompanyResearchPanel
            company={companyQuery}
            t={t}
            isJa={isJa}
            job={researchJob?.company?.toLowerCase() === companyQuery.toLowerCase() ? researchJob : null}
            results={researchJob?.company?.toLowerCase() === companyQuery.toLowerCase() ? researchResults : []}
            error={researchJob?.company?.toLowerCase() === companyQuery.toLowerCase() ? researchError : ''}
            onStart={() => startCompanyResearch(companyQuery)}
            onAdd={addResearchResult}
            addedIds={addedResearchIds}
            addingId={addingId}
            onOpenSettings={onOpenSettings}
          />
        ) : null}

        <div className="intern-content">
          <div className="intern-results">
            <div className="intern-table-head" aria-hidden="true"><span>{t.rank}</span><span>{t.companyRole}</span><span>{t.match}</span><span>{t.location}</span><span>{t.language}</span><span>{t.duration}</span><span>{t.deadline}</span><span>{t.status}</span><span>{t.apply}</span><span /></div>
            <div className="intern-rows" role="list">
              {pageItems.map((item, index) => {
                const status = statusFor(item.id);
                const [roleLead, ...roleDetails] = splitRole(displayRole(item.role, isJa));
                const languageParts = splitLanguageRequirement(item.language, isJa);
                const durationParts = splitDuration(item.duration, isJa);
                const locationParts = splitLocation(item.location, isJa);
                return <React.Fragment key={item.id}>
                  <article
                    className={`intern-row ${item.priority ? 'priority' : ''}`}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`${displayCompany(item, isJa)}: ${isJa ? '詳細を開く' : 'Open internship details'}`}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={event => {
                      // Only the row itself opens the drawer on Enter/Space — not when a
                      // child control (the status <select> or company button) is focused,
                      // so keyboard users can operate the select without opening the drawer.
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(item.id);
                      }
                    }}
                  >
                    <span className="intern-rank">{(page - 1) * pageSize + index + 1}</span>
                    <span className="intern-company-cell"><CompanyLogo item={item} /><button type="button" className="intern-company-trigger" onClick={() => setSelectedId(item.id)} aria-label={`${displayCompany(item, isJa)}: ${isJa ? '詳細を開く' : 'Open internship details'}`}><strong>{displayCompany(item, isJa)}</strong><small className="intern-role-stack"><span>{roleLead}</span>{roleDetails.map((part, i) => <span key={`${part}-${i}`}>{part}</span>)}</small></button></span>
                    <span className="intern-match"><strong>{item.score}%</strong><small>{item.priority ? t.priority : t.matchLabel(item.score)}</small></span>
                    <span className="intern-location" data-label={t.location}><MapPin size={13} /><span className="intern-location-stack">{locationParts.map((part, i) => <span key={`${part}-${i}`}>{part}</span>)}</span></span>
                    <span className="intern-language" data-label={t.language}><Globe2 size={13} /><span className="intern-language-stack">{languageParts.map((part, i) => <span key={`${part}-${i}`}>{part}</span>)}</span></span>
                    <span className="intern-duration" data-label={t.duration}><span className="intern-duration-stack">{durationParts.map((part, i) => <span key={`${part}-${i}`}>{part}</span>)}</span></span>
                    <span className={`intern-deadline ${deadlineClass(item)}`} data-label={t.deadline}>{formatDeadline(item.deadline, isJa)}</span>
                    <select className={`intern-row-status ${status || 'untracked'}`} value={status} onClick={event => event.stopPropagation()} onChange={event => handleStatusSelect(item, event.target.value)} aria-label={`${t.status}: ${displayCompany(item, isJa)}`}><option value="">{t.track}</option>{APPLICATION_STATUSES.map(option => <option key={option.value} value={option.value}>{statusLabel(option.value, isJa)}</option>)}</select>
                    <a className="intern-apply" href={item.url} target="_blank" rel="noreferrer" onClick={event => { event.stopPropagation(); onApply(item); }}>{t.apply} <ExternalLink size={13} /></a>
                    <button type="button" className={`intern-bookmark ${status === 'saved' ? 'active' : ''}`} onClick={event => { event.stopPropagation(); toggleSaved(item); }} aria-label={t.saveLabel(displayCompany(item, isJa), status === 'saved')}>{status === 'saved' ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button>
                  </article>
                </React.Fragment>;
              })}
            </div>
            {!pageItems.length ? <div className="intern-empty"><Search size={22} /><strong>{t.noMatches}</strong><span>{t.noMatchesSub}</span><button type="button" onClick={clearFilters}>{t.reset}</button></div> : null}
            <footer className="intern-pagination"><span>{t.showing(start, end, filtered.length)}</span><div><button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1} aria-label={t.previousPage}><ChevronLeft size={16} /></button><span>{t.page(page, pageCount)}</span><button type="button" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={page === pageCount} aria-label={t.nextPage}><ChevronRight size={16} /></button></div></footer>
          </div>
        </div>
        {selected ? (
          <div className="intern-detail-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setSelectedId(''); }}>
            <DetailPanel item={selected} status={statusFor(selected.id)} onStatus={handleStatusSelect} onApply={onApply} onClose={() => setSelectedId('')} onOpenEditor={onOpenEditor} isJa={isJa} />
          </div>
        ) : null}
      </section>
      <InterviewDateModal
        open={Boolean(interviewTarget)}
        applicationLabel={interviewTarget ? `${displayCompany(interviewTarget, isJa)} — ${displayRole(interviewTarget.role, isJa)}` : ''}
        isJa={isJa}
        onConfirm={confirmInterviewDate}
        onCancel={() => setInterviewTarget(null)}
      />
      <p className="intern-disclaimer">{t.disclaimer}</p>
      <span className="intern-lang-note" aria-hidden="true">{isJa ? 'JA' : 'EN'}</span>
    </main>
  );
}
