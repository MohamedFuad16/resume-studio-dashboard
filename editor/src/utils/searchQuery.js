// Plain-language radar search: "internships in AI engineering with no
// experience, Tokyo, English OK" becomes filters the user can see as chips and
// remove one by one. Rule-based on purpose: it runs on every keystroke at no
// cost, and it stays as the fallback when the phase 2 LLM parser is down.
//
// Pure module: no React, no I/O. Tested by searchQuery.test.js.
import { inferJobType } from './jobType.js';

const FIELDS = [
  {
    id: 'ai', label: { en: 'AI / ML', ja: 'AI・機械学習' },
    query: /\b(?:ai|a\.i\.|artificial intelligence|machine learning|ml|deep learning|llms?|gen ?ai|generative ai|nlp|computer vision|data science)\b|人工知能|機械学習|深層学習|生成ai|データサイエンス/i,
    match: /\b(?:ai|machine learning|ml|deep learning|llms?|nlp|computer vision|data scien\w*|pytorch|tensorflow)\b|人工知能|機械学習|深層学習|ＡＩ/i,
  },
  {
    id: 'frontend', label: { en: 'Front end', ja: 'フロントエンド' },
    query: /\b(?:front[- ]?end|web ui|react|vue|next\.?js)\b|フロントエンド/i,
    match: /\bfront[- ]?end\b|\breact\b|\bvue\b|\btypescript\b|\bnext\.?js\b|フロントエンド/i,
  },
  {
    id: 'backend', label: { en: 'Back end', ja: 'バックエンド' },
    query: /\b(?:back[- ]?end|server[- ]side)\b|バックエンド|サーバーサイド/i,
    match: /\bback[- ]?end\b|\bserver\b|\bapis?\b|\bgo(?:lang)?\b|\bjava\b|\bruby\b|\brails\b|バックエンド|サーバー/i,
  },
  {
    id: 'mobile', label: { en: 'Mobile', ja: 'モバイル' },
    query: /\b(?:mobile|ios|android|swift|kotlin|flutter)\b|モバイル|アプリ開発/i,
    match: /\b(?:mobile|ios|android|swift|kotlin|flutter)\b|モバイル/i,
  },
  {
    id: 'infra', label: { en: 'Infra / cloud', ja: 'インフラ・クラウド' },
    query: /\b(?:infra(?:structure)?|sre|devops|cloud)\b|インフラ|クラウド/i,
    match: /\b(?:infra\w*|sre|devops|cloud|aws|gcp|azure|kubernetes|platform)\b|インフラ|クラウド/i,
  },
  {
    id: 'security', label: { en: 'Security', ja: 'セキュリティ' },
    query: /\b(?:security|cyber ?security)\b|セキュリティ/i,
    match: /\bsecurity\b|セキュリティ/i,
  },
  {
    id: 'data', label: { en: 'Data', ja: 'データ' },
    query: /\bdata (?:engineering|engineer|analytics|analysis|analyst)\b|データエンジニア|データ分析/i,
    match: /\bdata\b|\bsql\b|\banalytics\b|データ/i,
  },
  {
    id: 'design', label: { en: 'Design / UX', ja: 'デザイン' },
    query: /\b(?:ux|ui\/ux|product design|designer)\b|デザイン/i,
    match: /\bdesign\w*\b|\bux\b|デザイン/i,
  },
];

const JOB_TYPE_RULES = [
  ['internship', /\bintern(?:ship)?s?\b|\bco-?ops?\b|インターン/i],
  ['new_grad', /\bnew[- ]?grads?\b|\bgraduates?\b|新卒|\d\d卒/i],
  ['full_time', /\bfull[- ]?time\b|正社員|中途/i],
];
const JOB_TYPE_LABELS = {
  internship: { en: 'Internship', ja: 'インターン' },
  new_grad: { en: 'New grad', ja: '新卒' },
  full_time: { en: 'Full time', ja: '中途・正社員' },
};

const CITIES = [
  ['Tokyo', '東京', /\btokyo\b|東京/i],
  ['Osaka', '大阪', /\bosaka\b|大阪/i],
  ['Kyoto', '京都', /\bkyoto\b|京都/i],
  ['Fukuoka', '福岡', /\bfukuoka\b|福岡/i],
  ['Nagoya', '名古屋', /\bnagoya\b|名古屋/i],
  ['Yokohama', '横浜', /\byokohama\b|横浜/i],
  ['Sapporo', '札幌', /\bsapporo\b|札幌/i],
];

const NO_EXPERIENCE = /\b(?:no|without|zero|little) (?:prior |previous )?(?:work )?(?:experience|exp)\b(?: (?:needed|required|necessary))?|\bno experience (?:needed|required)\b|\bbeginners?\b|\bentry[- ]level\b|未経験(?:可|歓迎|ok)?|経験不問|初心者/i;
const NO_JAPANESE = /\bno japanese\b|\bjapanese (?:not )?(?:required|needed)\b|\bwithout japanese\b|日本語不要|日本語なし/i;
const ENGLISH = /\benglish\b|英語/i;
const BILINGUAL = /\bbilingual\b|バイリンガル/i;
const REMOTE = /\bremote\b|リモート|在宅/i;
const JAPAN = /\bjapan\b|日本(?!語)/i;
const GLOBAL = /\boverseas\b|\bglobal\b|\babroad\b|海外/i;
// "closing / deadline / due" in front of the window is part of the phrase, so it
// does not linger as a keyword that no listing contains.
const DUE = '(?:(?:closing|deadline|due|ending|apply)(?: by| in| within)? )?';
const DEADLINES = [
  [7, new RegExp(`\\b${DUE}(?:this week|next 7 days|within (?:a|one) week)\\b|今週(?:締切|締め切り)?|1週間以内`, 'i')],
  [14, /\b(?:closing|deadline|ending) soon\b|締切間近|締め切り間近/i],
  [30, new RegExp(`\\b${DUE}(?:this month|next 30 days|within (?:a|one) month)\\b|今月(?:締切|締め切り)?|1か月以内|1ヶ月以内`, 'i')],
];

const STOPWORDS = new Set([
  'i', 'im', "i'm", 'want', 'need', 'looking', 'look', 'for', 'show', 'me', 'find', 'search', 'get', 'any', 'some', 'all',
  'companies', 'company', 'roles', 'role', 'jobs', 'job', 'positions', 'position', 'opportunities', 'opportunity', 'openings',
  'that', 'which', 'who', 'have', 'has', 'having', 'with', 'in', 'at', 'on', 'of', 'to', 'the', 'a', 'an', 'and', 'or', 'is',
  'are', 'be', 'offer', 'offering', 'offers', 'please', 'ok', 'okay', 'fine', 'based', 'friendly', 'where', 'can', 'apply',
  'engineering', 'engineer', 'engineers', 'developer', 'developers', 'development', 'program', 'programs', 'speaking',
  'の', 'を', 'が', 'で', 'に', 'は', 'と', 'や', 'も', '募集', '求人', '企業', '会社', 'ある', 'したい', '探して', 'ください', '見つけて', '職',
]);

const lower = value => String(value || '').toLowerCase();

export function parseSearchQuery(raw) {
  const text = String(raw || '').trim();
  const filters = { jobType: null, city: null, region: null, languageType: null, deadlineDays: null, noExperience: false, fields: [], keywords: [] };
  if (!text) return { text, filters, chips: [] };

  let rest = ` ${lower(text)} `;
  const consume = re => {
    const match = rest.match(re);
    if (!match) return false;
    rest = rest.replace(match[0], ' ');
    return true;
  };

  for (const [type, re] of JOB_TYPE_RULES) {
    if (consume(re)) { filters.jobType = type; break; }
  }
  if (consume(NO_EXPERIENCE)) filters.noExperience = true;
  for (const field of FIELDS) {
    if (consume(field.query)) filters.fields.push(field.id);
  }
  for (const [en, ja, re] of CITIES) {
    if (consume(re)) { filters.city = { en, ja }; break; }
  }
  if (consume(REMOTE)) filters.region = 'Remote';
  else if (consume(GLOBAL)) filters.region = 'Global';
  else if (consume(JAPAN) && !filters.city) filters.region = 'Japan';
  if (consume(NO_JAPANESE)) filters.languageType = 'English-first';
  else if (consume(BILINGUAL)) filters.languageType = 'Bilingual';
  else if (consume(ENGLISH)) filters.languageType = 'English-first';
  for (const [days, re] of DEADLINES) {
    if (consume(re)) { filters.deadlineDays = days; break; }
  }

  filters.keywords = rest
    .split(/[\s,、。.!?！？()（）]+/)
    .map(word => word.trim())
    .filter(word => word.length >= 2 && !STOPWORDS.has(word));

  return { text, filters, chips: chipsFor(filters) };
}

function chipsFor(filters) {
  const chips = [];
  if (filters.jobType) chips.push({ key: 'jobType', label: JOB_TYPE_LABELS[filters.jobType] });
  if (filters.noExperience) chips.push({ key: 'noExperience', label: { en: 'No experience required', ja: '未経験可' } });
  for (const id of filters.fields) {
    const field = FIELDS.find(entry => entry.id === id);
    chips.push({ key: `field:${id}`, label: field.label });
  }
  if (filters.city) chips.push({ key: 'city', label: filters.city });
  if (filters.region) chips.push({ key: 'region', label: { Remote: { en: 'Remote', ja: 'リモート' }, Japan: { en: 'Japan', ja: '日本' }, Global: { en: 'Outside Japan', ja: '海外' } }[filters.region] });
  if (filters.languageType) chips.push({ key: 'languageType', label: filters.languageType === 'Bilingual' ? { en: 'Bilingual', ja: 'バイリンガル' } : { en: 'English OK', ja: '英語可' } });
  if (filters.deadlineDays) chips.push({ key: 'deadlineDays', label: { en: `Deadline within ${filters.deadlineDays} days`, ja: `締切${filters.deadlineDays}日以内` } });
  for (const word of filters.keywords) chips.push({ key: `keyword:${word}`, label: { en: `“${word}”`, ja: `「${word}」` } });
  return chips;
}

// True when the query asked for structure (a type, place, field...), as opposed
// to a bare word or company name, which the old keyword search handles.
export const hasStructuredFilters = parsed => parsed.chips.some(chip => !chip.key.startsWith('keyword:'));

// Drop the filters whose chips the user removed.
export function withoutChips(filters, dismissed) {
  if (!dismissed?.size) return filters;
  const next = { ...filters, fields: [...filters.fields], keywords: [...filters.keywords] };
  for (const key of dismissed) {
    if (key.startsWith('field:')) next.fields = next.fields.filter(id => `field:${id}` !== key);
    else if (key.startsWith('keyword:')) next.keywords = next.keywords.filter(word => `keyword:${word}` !== key);
    else if (key === 'noExperience') next.noExperience = false;
    else next[key] = null;
  }
  return next;
}

const itemText = item => [
  item.company, item.companyJa, item.role, item.roleJa, item.track, item.location, item.city, item.language,
  item.about, item.fitNote, item.workAuth, ...(item.reasons || []), ...(item.techStack || []), ...(item.eligibility || []),
].filter(Boolean).join(' ');

const JAPAN_PLACE = /\b(?:japan|tokyo|osaka|kyoto|yokohama|fukuoka|nagoya|sapporo)\b|日本|東京|大阪|京都|横浜|福岡|名古屋|札幌/i;
// An eligibility line asking for experience rules a listing out of "no
// experience", unless the line itself says experience is not needed.
const ASKS_EXPERIENCE = /experience|経験/i;
const WAIVES_EXPERIENCE = /no (?:prior )?experience|not required|未経験|経験不問|歓迎/i;

export function matchesParsedFilters(item, filters, now = Date.now()) {
  if (filters.jobType && inferJobType(item) !== filters.jobType) return false;
  const place = `${item.location || ''} ${item.city || ''} ${item.workMode || ''} ${item.region || ''} ${item.country || ''}`;
  if (filters.city && !new RegExp(`${filters.city.en}|${filters.city.ja}`, 'i').test(place)) return false;
  if (filters.region === 'Remote' && !REMOTE.test(place)) return false;
  if (filters.region === 'Japan' && !JAPAN_PLACE.test(place)) return false;
  if (filters.region === 'Global' && JAPAN_PLACE.test(place)) return false;
  if (filters.languageType && item.languageType !== filters.languageType) return false;
  if (filters.deadlineDays) {
    if (!item.deadlineDate) return false;
    const limit = new Date(now + filters.deadlineDays * 86400000).toISOString().slice(0, 10);
    if (item.deadlineDate > limit) return false;
  }
  const text = itemText(item);
  if (filters.noExperience) {
    const lines = [...(item.eligibility || []), ...String(item.workAuth || '').split(';')];
    if (lines.some(line => ASKS_EXPERIENCE.test(line) && !WAIVES_EXPERIENCE.test(line))) return false;
  }
  for (const id of filters.fields) {
    const field = FIELDS.find(entry => entry.id === id);
    if (field && !field.match.test(text)) return false;
  }
  const haystack = lower(text);
  return filters.keywords.every(word => haystack.includes(word));
}
