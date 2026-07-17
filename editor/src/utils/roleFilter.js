/**
 * Non-internship gig detection. Gmail records ingested before the classifier's
 * `isInternship` gate (or mis-classified) can leave freelance/crowdwork/"AI
 * trainer"-type gigs in the tracker. The dashboard's Recent applications should
 * show only real internships, so these are filtered from that view.
 *
 * Deliberately CONSERVATIVE — matches only unmistakable gig signals so a real
 * internship (e.g. a "Data Analyst Internship") is never hidden. "analyst" and
 * "part-time" alone are NOT gig signals; "email analyst" (a named gig) is.
 */

// Whole-phrase gig markers (EN + JA). Each is specific enough not to collide
// with a legitimate internship title.
const GIG_PATTERNS = [
  /language\s+(expert|specialist)/i,
  /言語\s*(エキスパート|スペシャリスト)/,
  /email\s+analyst/i,
  /\b(ai|llm|data|search|content|speech|voice)\s*trainer\b/i,
  /\btrainer\b.*\b(gig|freelance|remote task)\b/i,
  /annotat(or|ion)/i,
  /アノテーション/,
  /crowd[\s-]?work/i,
  /クラウドワーク/,
  /transcrib(er|ing)|transcription/i,
  /\brater\b|\bevaluator\b/i,
  /\bfreelance\b/i,
  /フリーランス/,
  /\bgig\b/i,
  /data\s+entry/i,
  /micro[\s-]?task/i,
  /\btutor(ing)?\b/i,
  /survey\s+(taker|panel|participant)/i,
];

/** True when the role/company reads as a freelance/gig task, not an internship. */
export function isGigRole(record) {
  const haystack = `${record?.role || ''} ${record?.company || ''}`;
  return GIG_PATTERNS.some(pattern => pattern.test(haystack));
}

/** Keep only real internships (drops gigs). Pass tracker records. */
export function internshipRecordsOnly(records) {
  return (records || []).filter(record => !isGigRole(record));
}
