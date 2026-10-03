// Job type for an application or a listing: internship, new grad (新卒) or full
// time. The rebuilt classifier will send `jobType` on every record; until then
// the type is read from the role text (and, for Gmail records, the email
// subject). A type the owner picks by hand is stored as `jobType` with
// `jobTypePinned: true`, so it always wins over inference.
//
// Pure module: no React, no I/O. Tested by jobType.test.js.

export const JOB_TYPES = ['internship', 'new_grad', 'full_time'];
// `unknown` is only for records with no role text at all (a role-less Gmail
// record reads "Application"); they get their own "Unsorted" bucket instead of
// being guessed into one of the three.
export const JOB_TYPE_UNKNOWN = 'unknown';

const LABELS = {
  internship: { en: 'Internship', ja: 'インターン' },
  new_grad: { en: 'New grad', ja: '新卒' },
  full_time: { en: 'Full time', ja: '中途・正社員' },
  unknown: { en: 'Unsorted', ja: '未分類' },
};

// Co-ops and apprenticeships are paid training terms; they count as internships.
// Order matters: "Class of 2028 Software Engineer Internship" is an internship
// even though "Class of 2028" also reads as new grad.
const INTERNSHIP = /\bintern(?:ship)?s?\b|インターン|就業体験|\bco-?op\b|\bapprentice(?:ship)?\b|\bwork term\b|\bplacement year\b|\bsummer (?:program|camp)\b|\btech camp\b|\bwork experience\b/i;
const NEW_GRAD = /\bnew[- ]?grad(?:uate)?s?\b|\bgraduate (?:program|hire|role|position|scheme)\b|新卒|\b20\d\d\s*卒|\d\d卒|\bclass of 20\d\d\b|\bentry[- ]level\b|\bcampus hire\b|\bearly career\b/i;
const FULL_TIME = /\bfull[- ]?time\b|正社員|中途|\bmid[- ]career\b|\bsenior\b|\bstaff (?:engineer|scientist)\b|\bprincipal\b|\bengineering manager\b/i;
const NO_ROLE = /^(?:application|応募)?$/i;

export function inferJobType(item) {
  if (!item) return JOB_TYPE_UNKNOWN;
  if (JOB_TYPES.includes(item.jobType)) return item.jobType;
  // schema.org JobPosting values (INTERN, FULL_TIME) once collectors read JSON-LD.
  const employment = String(item.employmentType || '').toUpperCase();
  if (employment.includes('INTERN')) return 'internship';

  const role = String(item.role || item.title || '').trim();
  const text = [role, item.track, item.sourceMeta?.subject].filter(Boolean).join(' ');
  if (INTERNSHIP.test(text)) return 'internship';
  if (NEW_GRAD.test(text)) return 'new_grad';
  if (FULL_TIME.test(text) || employment.includes('FULL_TIME')) return 'full_time';
  // A real role title with no intern or new-grad marker is a regular full-time
  // opening. Only a record with no role at all stays unsorted.
  return NO_ROLE.test(role) ? JOB_TYPE_UNKNOWN : 'full_time';
}

export function jobTypeLabel(type, isJa = false) {
  const entry = LABELS[type] || LABELS.unknown;
  return isJa ? entry.ja : entry.en;
}

export function jobTypeCounts(records) {
  const counts = { all: 0, internship: 0, new_grad: 0, full_time: 0, unknown: 0 };
  for (const record of records || []) {
    counts.all += 1;
    counts[inferJobType(record)] += 1;
  }
  return counts;
}

export function filterByJobType(records, type) {
  if (!type || type === 'all') return records;
  return (records || []).filter(record => inferJobType(record) === type);
}
