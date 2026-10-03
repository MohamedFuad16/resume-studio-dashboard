// Résumé, CV, 履歴書, 職務経歴書 and cover-letter drafts from the master profile.
//
// Phase 2: an LLM rewrites bullets in STAR form for the target role. This module
// is the sample version and the shared shape: it only SELECTS and ORDERS what the
// master profile already says, so a draft can never contain an employer, date,
// degree or claim the owner did not write. Template sentences in letters are
// generic and carry no facts beyond the profile and the job posting.
//
// Pure module: no React, no I/O. Shared with the server in phase 2. Tested by
// tailor.test.js.

export const DOCUMENT_KINDS = ['resume', 'cv', 'rirekisho', 'shokumu', 'cover_letter'];
export const KIND_LABELS = {
  resume: { en: 'Résumé', ja: 'レジュメ' },
  cv: { en: 'CV', ja: 'CV' },
  rirekisho: { en: 'Rirekisho (履歴書)', ja: '履歴書' },
  shokumu: { en: 'Career history (職務経歴書)', ja: '職務経歴書' },
  cover_letter: { en: 'Cover letter', ja: 'カバーレター' },
};
// 履歴書 and 職務経歴書 are Japanese forms; they are always written in Japanese.
export const JAPANESE_ONLY = new Set(['rirekisho', 'shokumu']);

const str = value => String(value ?? '').trim();
const list = value => (Array.isArray(value) ? value.map(str).filter(Boolean) : []);
const splitComma = value => (Array.isArray(value) ? list(value) : str(value).split(/\s*[,、]\s*/).filter(Boolean));
const keyOf = value => str(value).toLowerCase().replace(/株式会社|\(.*?\)|（.*?）/g, '').replace(/[^a-z0-9぀-ヿ一-鿿]+/g, '');

// ── Master profile ────────────────────────────────────────────────────
// The single structured profile every document is drawn from. Built from the
// stored résumé JSON (which the PDF upload fills); phase 2 has the LLM build it
// once from the uploaded PDF and keep it read-only.
export function masterProfileFromResume(resume) {
  const r = resume || {};
  const p = r.personal || {};
  const ja = r.japanese || {};
  const jaExperience = Array.isArray(ja.experience) ? ja.experience : [];
  const jaBulletsFor = company => {
    const hit = jaExperience.find(entry => keyOf(entry.company) === keyOf(company) || keyOf(entry.companyJa) === keyOf(company));
    return hit ? { bullets: list(hit.bulletsJa), companyJa: str(hit.companyJa), roleJa: str(hit.roleJa) } : null;
  };

  const education = (r.education || []).map((e, i) => ({
    id: e.id || `edu-${i}`,
    school: { en: str(e.institution || e.school), ja: str(e.institutionJa || e.schoolJa) },
    degree: { en: str(e.degree), ja: str(e.degreeJa) },
    location: str(e.location),
    start: str(e.startDate),
    end: str(e.endDate),
    bullets: { en: list(e.bullets), ja: list(e.bulletsJa) },
  })).filter(e => e.school.en || e.school.ja);

  const experience = (r.experience || []).map((e, i) => {
    const jaMatch = jaBulletsFor(e.company);
    return {
      id: e.id || `exp-${i}`,
      org: { en: str(e.company), ja: str(e.companyJa) || jaMatch?.companyJa || '' },
      role: { en: str(e.role), ja: str(e.roleJa) || jaMatch?.roleJa || '' },
      location: str(e.location),
      start: str(e.startDate),
      end: str(e.endDate),
      bullets: { en: list(e.bullets).length ? list(e.bullets) : list([e.description]), ja: list(e.bulletsJa).length ? list(e.bulletsJa) : (jaMatch?.bullets || []) },
    };
  }).filter(e => e.org.en || e.org.ja);

  const projects = (r.projects || []).map((pr, i) => ({
    id: pr.id || `prj-${i}`,
    title: str(pr.title || pr.name),
    tech: str(pr.tech),
    year: str(pr.year),
    link: str(pr.link),
    bullets: { en: list(pr.bullets).length ? list(pr.bullets) : list([pr.description]), ja: list(pr.bulletsJa) },
  })).filter(pr => pr.title);

  const activities = (r.activities || []).map((a, i) => ({
    id: a.id || `act-${i}`,
    title: { en: str(a.title), ja: str(a.titleJa) },
    org: { en: str(a.org), ja: str(a.orgJa) },
    start: str(a.startDate),
    end: str(a.endDate),
    bullets: { en: list(a.bullets), ja: list(a.bulletsJa) },
  })).filter(a => a.title.en || a.title.ja);

  const skillGroups = [];
  const s = r.skills;
  if (Array.isArray(s)) {
    if (s.length) skillGroups.push({ id: 'skills', label: { en: 'Skills', ja: 'スキル' }, items: list(s) });
  } else if (s && typeof s === 'object') {
    const labels = {
      languages: { en: 'Languages', ja: 'プログラミング言語' },
      frameworks: { en: 'Frameworks', ja: 'フレームワーク' },
      tools: { en: 'Tools', ja: 'ツール' },
      concepts: { en: 'Concepts', ja: '知識' },
      spoken: { en: 'Spoken languages', ja: '語学' },
    };
    for (const [id, label] of Object.entries(labels)) {
      const items = splitComma(s[id]);
      if (items.length) skillGroups.push({ id, label, items });
    }
  }

  return {
    name: { en: str(p.nameEn), ja: str(p.nameJa), kana: str(p.furigana) },
    contact: {
      email: str(p.email), phone: str(p.phone), address: str(p.address), postalCode: str(p.postalCode),
      linkedin: str(p.linkedin), github: str(p.github),
    },
    dob: str(p.dob),
    summary: { en: str(r.summaryEn || r.summary), ja: str(r.summaryJa || ja.summary) },
    selfPr: { ja: str(ja.selfPr) },
    qualifications: (Array.isArray(ja.qualifications) ? ja.qualifications : [])
      .map(q => ({ year: str(q.year), month: str(q.month), name: str(q.name) })).filter(q => q.name),
    spokenLanguages: list(ja.languages),
    education, experience, projects, activities, skillGroups,
    counts: {
      education: education.length, experience: experience.length, projects: projects.length,
      skills: skillGroups.reduce((n, g) => n + g.items.length, 0),
    },
  };
}

// ── Format suggestion ─────────────────────────────────────────────────
const JAPANESE_REQUIRED = /\bn[12]\b|business[- ]level japanese|native[- ]level japanese|fluent japanese|japanese (?:fluency|native|business)|日本語.*(?:ネイティブ|ビジネス|n1|n2)/i;
const RESEARCH = /\bresearch\b|\bphd\b|\bacademic\b|\blaborator(?:y|ies)\b|研究/i;

export function suggestFormat(job) {
  const language = str(job?.language);
  const roleText = `${str(job?.role)} ${str(job?.track)}`;
  const englishFirst = job?.languageType === 'English-first' || (/english/i.test(language) && !JAPANESE_REQUIRED.test(language));
  const japanese = !englishFirst && (JAPANESE_REQUIRED.test(language) || Boolean(job?.companyJa) || /[぀-ヿ一-鿿]/.test(str(job?.company)));
  const fullTime = /full[- ]?time|正社員|中途|senior|mid[- ]career/i.test(roleText);
  if (RESEARCH.test(roleText)) {
    return { lang: englishFirst ? 'en' : 'ja', kind: 'cv', reason: { en: 'Research roles usually ask for a CV that lists every project and publication.', ja: '研究職ではプロジェクトや論文をすべて記載したCVが一般的です。' } };
  }
  if (japanese) {
    return fullTime
      ? { lang: 'ja', kind: 'shokumu', reason: { en: 'A Japanese company hiring mid-career usually asks for a 職務経歴書 with the 履歴書.', ja: '日本企業の中途採用では、履歴書とあわせて職務経歴書の提出が一般的です。' } }
      : { lang: 'ja', kind: 'rirekisho', reason: { en: 'Japanese companies usually ask interns and new grads for a 履歴書.', ja: '日本企業のインターン・新卒選考では履歴書の提出が一般的です。' } };
  }
  return { lang: 'en', kind: 'resume', reason: { en: 'This is an English-first role, so a one-page English résumé fits best.', ja: '英語中心の募集のため、1枚の英文レジュメが適しています。' } };
}

// ── Tailoring ─────────────────────────────────────────────────────────
const STOP = new Set(['and', 'or', 'the', 'for', 'with', 'from', 'into', 'your', 'our', 'you', 'are', 'will', 'team', 'teams', 'role', 'work', 'program', 'internship', 'intern', 'engineer', 'engineering', 'software', 'japan', 'tokyo']);
const tokens = text => new Set(str(text).toLowerCase().split(/[^a-z0-9+#.]+/).filter(t => t.length >= 2 && !STOP.has(t)));

function jobKeywords(job) {
  return tokens([job?.role, job?.track, job?.about, job?.fitNote, ...(job?.techStack || []), ...(job?.reasons || [])].join(' '));
}
const relevance = (text, keywords) => {
  let score = 0;
  for (const t of tokens(text)) if (keywords.has(t)) score += 1;
  return score;
};
// Highest relevance first; ties keep the owner's own order.
const byRelevance = (items, textOf, keywords) => items
  .map((item, index) => ({ item, index, score: relevance(textOf(item), keywords) }))
  .sort((a, b) => b.score - a.score || a.index - b.index)
  .map(entry => entry.item);

const pick = (pair, lang) => (lang === 'ja' ? (pair.ja || pair.en) : (pair.en || pair.ja));
// JA bullets when they exist; otherwise the English ones, flagged so the UI can
// say they still need translating (phase 2's LLM translates them).
const bulletsFor = (pair, lang) => {
  if (lang !== 'ja') return { bullets: pair.en.length ? pair.en : pair.ja, untranslated: false };
  return pair.ja.length ? { bullets: pair.ja, untranslated: false } : { bullets: pair.en, untranslated: pair.en.length > 0 };
};
const range = (start, end, lang) => {
  const present = lang === 'ja' ? '現在' : 'Present';
  const endText = end || present;
  if (!start && !end) return '';
  return lang === 'ja' ? `${start}〜${endText}` : `${start} – ${endText}`;
};

const TITLES = {
  en: { summary: 'Summary', experience: 'Experience', projects: 'Projects', education: 'Education', skills: 'Skills', activities: 'Activities' },
  ja: { summary: '概要', experience: '職歴', projects: 'プロジェクト', education: '学歴', skills: 'スキル', activities: '課外活動' },
};

let seq = 0;
const itemId = prefix => `${prefix}-${(seq += 1)}`;

function experienceItems(profile, lang) {
  return profile.experience.map(e => {
    const { bullets, untranslated } = bulletsFor(e.bullets, lang);
    return { id: itemId('exp'), heading: pick(e.role, lang), subheading: pick(e.org, lang), meta: range(e.start, e.end, lang), bullets, untranslated };
  });
}
function projectItems(projects, lang) {
  return projects.map(pr => {
    const { bullets, untranslated } = bulletsFor(pr.bullets, lang);
    return { id: itemId('prj'), heading: pr.title, subheading: pr.tech, meta: pr.year, link: pr.link, bullets, untranslated };
  });
}
function educationItems(profile, lang) {
  return profile.education.map(e => {
    const { bullets, untranslated } = bulletsFor(e.bullets, lang);
    return { id: itemId('edu'), heading: pick(e.school, lang), subheading: pick(e.degree, lang), meta: range(e.start, e.end, lang), bullets, untranslated };
  });
}
function skillItems(profile, keywords, lang) {
  return profile.skillGroups.map(group => ({
    id: itemId('skl'),
    heading: pick(group.label, lang),
    subheading: '',
    meta: '',
    // Skills the posting mentions come first; nothing is added or dropped.
    bullets: byRelevance(group.items, value => value, keywords),
  }));
}
function activityItems(profile, lang) {
  return profile.activities.map(a => {
    const { bullets, untranslated } = bulletsFor(a.bullets, lang);
    return { id: itemId('act'), heading: pick(a.title, lang), subheading: pick(a.org, lang), meta: range(a.start, a.end, lang), bullets, untranslated };
  });
}

function header(profile, lang) {
  const c = profile.contact;
  const links = [];
  if (c.github) links.push({ label: c.github.replace(/^https?:\/\/(www\.)?/, ''), url: c.github });
  if (c.linkedin) links.push({ label: c.linkedin.replace(/^https?:\/\/(www\.)?/, ''), url: c.linkedin });
  return {
    name: lang === 'ja' ? (profile.name.ja || profile.name.en) : (profile.name.en || profile.name.ja),
    nameAlt: lang === 'ja' ? profile.name.en : '',
    kana: profile.name.kana,
    email: c.email, phone: c.phone, address: c.address, postalCode: c.postalCode,
    dob: profile.dob,
    links,
  };
}

// "Apr 2024", "2024-04", "2024年4月", "Mar 2028 (Expected)" -> { year, month, expected }
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function parseYearMonth(value) {
  const text = str(value);
  if (!text || /^present$|^現在$/i.test(text)) return null;
  const expected = /expected|見込/i.test(text);
  let m = text.match(/(\d{4})[-/.年]\s*(\d{1,2})/);
  if (m) return { year: m[1], month: String(Number(m[2])), expected };
  m = text.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) return { year: m[2], month: String(MONTHS[m[1].toLowerCase()]), expected };
  m = text.match(/(\d{4})/);
  return m ? { year: m[1], month: '', expected } : null;
}

function rirekishoRows(profile) {
  const rows = [{ year: '', month: '', text: '学歴', heading: true }];
  for (const e of profile.education) {
    const school = e.school.ja || e.school.en;
    const faculty = e.degree.ja ? ` ${e.degree.ja.replace(/（.*?）/g, '')}` : '';
    const start = parseYearMonth(e.start);
    const end = parseYearMonth(e.end);
    if (start) rows.push({ year: start.year, month: start.month, text: `${school}${faculty} 入学` });
    if (end) rows.push({ year: end.year, month: end.month, text: `${school}${faculty} ${end.expected ? '卒業見込み' : '卒業'}` });
  }
  rows.push({ year: '', month: '', text: '職歴', heading: true });
  if (!profile.experience.length) rows.push({ year: '', month: '', text: 'なし' });
  for (const e of profile.experience) {
    const org = e.org.ja || e.org.en;
    const role = e.role.ja || e.role.en;
    const start = parseYearMonth(e.start);
    const end = parseYearMonth(e.end);
    if (start) rows.push({ year: start.year, month: start.month, text: `${org} 入社${role ? `（${role}）` : ''}` });
    if (end) rows.push({ year: end.year, month: end.month, text: `${org} 退社` });
    else rows.push({ year: '', month: '', text: '現在に至る' });
  }
  rows.push({ year: '', month: '', text: '以上', end: true });
  return rows;
}

function coverLetter(profile, job, lang, keywords) {
  const company = str(job?.companyJa && lang === 'ja' ? job.companyJa : job?.company) || (lang === 'ja' ? '貴社' : 'your company');
  const role = str(job?.roleJa && lang === 'ja' ? job.roleJa : job?.role);
  const topProjects = byRelevance(profile.projects, pr => `${pr.title} ${pr.tech} ${pr.bullets.en.join(' ')}`, keywords).slice(0, 2);
  const skills = profile.skillGroups.flatMap(g => g.items);
  // Only skills the posting itself mentions may be called what the role needs.
  const matched = skills.filter(value => relevance(value, keywords) > 0).slice(0, 5);
  const mainSkills = matched.length ? matched : skills.slice(0, 3);
  const today = new Date();
  if (lang === 'ja') {
    const projectLine = topProjects.length
      ? `これまで${topProjects.map(pr => `「${pr.title}」`).join('や')}の開発に取り組んできました。${(topProjects[0].bullets.ja[0] || '')}`
      : '';
    return {
      date: `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`,
      recipient: `${company}\n採用ご担当者様`,
      greeting: '拝啓',
      paragraphs: [
        `${role ? `貴社の${role}に` : '貴社の募集に'}応募いたしたく、ご連絡いたしました。`,
        projectLine,
        mainSkills.length ? `${mainSkills.join('、')}を用いた開発経験を、貴社で活かしたいと考えております。` : '',
        'ご多忙のところ恐縮ですが、ご検討のほどよろしくお願い申し上げます。',
      ].filter(Boolean),
      closing: '敬具',
      signature: profile.name.ja || profile.name.en,
    };
  }
  const projectLine = topProjects.length
    ? `My most relevant work is ${topProjects.map(pr => pr.title).join(' and ')}. ${(topProjects[0].bullets.en[0] || '')}`
    : '';
  return {
    date: today.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    recipient: `Hiring Team\n${company}`,
    greeting: 'Dear Hiring Team,',
    paragraphs: [
      `I am writing to apply for ${role ? `the ${role} position` : 'a position'} at ${company}.`,
      projectLine,
      matched.length ? `I work with ${matched.join(', ')}, which this role calls for.` : (mainSkills.length ? `My main tools are ${mainSkills.join(', ')}.` : ''),
      `Thank you for considering my application. I would welcome the chance to talk about how I can contribute to ${company}.`,
    ].filter(Boolean),
    closing: 'Sincerely,',
    signature: profile.name.en || profile.name.ja,
  };
}

export function tailorDocument({ profile, job, lang: requestedLang = 'en', kind = 'resume' }) {
  const lang = JAPANESE_ONLY.has(kind) ? 'ja' : (requestedLang === 'ja' ? 'ja' : 'en');
  const keywords = jobKeywords(job);
  const titles = TITLES[lang];
  const target = { company: str(job?.company), companyJa: str(job?.companyJa), role: str(job?.role), jobId: str(job?.id), url: str(job?.url) };
  const base = { kind, lang, target, header: header(profile, lang), summary: '', sections: [], letter: null, rirekisho: null };
  const sortedProjects = byRelevance(profile.projects, pr => `${pr.title} ${pr.tech} ${pr.bullets.en.join(' ')}`, keywords);

  if (kind === 'cover_letter') {
    base.letter = coverLetter(profile, job, lang, keywords);
  } else if (kind === 'rirekisho') {
    base.rirekisho = {
      rows: rirekishoRows(profile),
      licenses: profile.qualifications.map(q => ({ year: q.year, month: q.month, text: q.name })),
      motivation: '',
      selfPr: profile.selfPr.ja || profile.summary.ja,
      requests: '貴社規定に従います。',
    };
  } else if (kind === 'shokumu') {
    base.summary = profile.summary.ja || profile.summary.en;
    base.sections = [
      { id: 'experience', type: 'experience', title: '職務経歴', items: experienceItems(profile, 'ja') },
      { id: 'projects', type: 'projects', title: '開発実績', items: projectItems(sortedProjects, 'ja') },
      { id: 'skills', type: 'skills', title: '活かせる経験・知識・技術', items: skillItems(profile, keywords, 'ja') },
    ];
    if (profile.selfPr.ja) base.sections.push({ id: 'selfpr', type: 'text', title: '自己PR', items: [{ id: itemId('pr'), heading: '', subheading: '', meta: '', bullets: [profile.selfPr.ja] }] });
  } else {
    base.summary = lang === 'ja' ? (profile.summary.ja || profile.summary.en) : (profile.summary.en || profile.summary.ja);
    const isCv = kind === 'cv';
    base.sections = [
      { id: 'experience', type: 'experience', title: titles.experience, items: experienceItems(profile, lang).slice(0, isCv ? undefined : 3) },
      { id: 'projects', type: 'projects', title: titles.projects, items: projectItems(sortedProjects.slice(0, isCv ? undefined : 3), lang) },
      { id: 'education', type: 'education', title: titles.education, items: educationItems(profile, lang) },
      { id: 'skills', type: 'skills', title: titles.skills, items: skillItems(profile, keywords, lang) },
    ];
    if (isCv && profile.activities.length) base.sections.push({ id: 'activities', type: 'activities', title: titles.activities, items: activityItems(profile, lang) });
  }
  base.sections = base.sections.filter(section => section.items.length);
  base.needsTranslation = base.sections.some(section => section.items.some(item => item.untranslated));
  return base;
}
