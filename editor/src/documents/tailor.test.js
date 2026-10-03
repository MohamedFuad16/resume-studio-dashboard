import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { masterProfileFromResume, parseYearMonth, suggestFormat, tailorDocument } from './tailor.js';

const resume = JSON.parse(readFileSync(new URL('../../server/profiles/mohamed_fuad.json', import.meta.url), 'utf8'));
const profile = masterProfileFromResume(resume);

// Every string the profile contains, flattened, so a draft's text can be checked
// against it word for word.
function profileStrings(value, out = new Set()) {
  if (typeof value === 'string') { if (value.trim()) out.add(value.trim()); return out; }
  if (Array.isArray(value)) { value.forEach(v => profileStrings(v, out)); return out; }
  if (value && typeof value === 'object') Object.values(value).forEach(v => profileStrings(v, out));
  return out;
}
const known = profileStrings(profile);

const mercari = {
  id: 'mercari-software-engineer-2028', company: 'Mercari Group', role: 'Class of 2028 Software Engineer Internship',
  track: 'Software Engineering', languageType: 'English-first', language: 'English or Japanese CEFR B2',
  techStack: ['Go / Kotlin / Swift / TypeScript', 'Backend APIs', 'Mobile / Web', 'SQL'], reasons: ['React/TypeScript and API development'],
};

test('the master profile reads the stored résumé, including the Japanese block', () => {
  assert.equal(profile.name.en, 'Mohamed Fuad');
  assert.ok(profile.counts.projects >= 4);
  assert.ok(profile.selfPr.ja.startsWith('私の強み'));
  assert.ok(profile.qualifications.some(q => q.name.includes('N2')));
});

for (const [kind, lang] of [['resume', 'en'], ['cv', 'en'], ['resume', 'ja'], ['shokumu', 'ja']]) {
  test(`${kind}/${lang} draft never contains text the profile does not`, () => {
    const doc = tailorDocument({ profile, job: mercari, lang, kind });
    for (const section of doc.sections) {
      for (const item of section.items) {
        for (const text of [item.heading, item.subheading, ...item.bullets].filter(Boolean)) {
          assert.ok(known.has(text), `invented text in ${kind}/${lang} ${section.id}: ${JSON.stringify(text)}`);
        }
      }
    }
    assert.ok(!doc.summary || known.has(doc.summary), 'summary must come from the profile');
  });
}

test('a résumé keeps at most three projects, a CV keeps them all, ordered by relevance', () => {
  const resumeDoc = tailorDocument({ profile, job: mercari, kind: 'resume' });
  const cvDoc = tailorDocument({ profile, job: mercari, kind: 'cv' });
  const count = doc => doc.sections.find(s => s.id === 'projects').items.length;
  assert.ok(count(resumeDoc) <= 3);
  assert.equal(count(cvDoc), profile.projects.length);
});

test('Japanese drafts flag bullets that only exist in English', () => {
  const doc = tailorDocument({ profile: { ...profile, projects: [{ id: 'p', title: 'Only English', tech: 'Go', year: '2025', link: '', bullets: { en: ['Built a thing.'], ja: [] } }] }, job: mercari, lang: 'ja', kind: 'resume' });
  assert.equal(doc.needsTranslation, true);
});

test('履歴書 and 職務経歴書 are always Japanese, whatever language was asked for', () => {
  assert.equal(tailorDocument({ profile, job: mercari, lang: 'en', kind: 'rirekisho' }).lang, 'ja');
  assert.equal(tailorDocument({ profile, job: mercari, lang: 'en', kind: 'shokumu' }).lang, 'ja');
});

test('履歴書 history rows: enrolment, expected graduation, and the closing 以上', () => {
  const doc = tailorDocument({ profile, job: mercari, kind: 'rirekisho' });
  const texts = doc.rirekisho.rows.map(row => row.text);
  assert.ok(texts.some(t => t.endsWith('入学')));
  assert.ok(texts.some(t => t.endsWith('卒業見込み')));
  assert.equal(texts.at(-1), '以上');
  assert.ok(doc.rirekisho.licenses.some(l => l.text.includes('N2')));
});

test('cover letter only claims the role needs skills the posting names', () => {
  const withMatch = tailorDocument({ profile, job: mercari, kind: 'cover_letter' });
  assert.ok(withMatch.letter.paragraphs.some(p => p.includes('which this role calls for')));
  const noMatch = tailorDocument({ profile, job: { company: 'Acme', role: 'Sommelier' }, kind: 'cover_letter' });
  assert.ok(!noMatch.letter.paragraphs.some(p => p.includes('which this role calls for')));
});

test('format suggestions', () => {
  assert.equal(suggestFormat(mercari).kind, 'resume');
  assert.equal(suggestFormat(mercari).lang, 'en');
  assert.equal(suggestFormat({ company: '株式会社サンプル', role: '27卒 エンジニア職', language: '日本語ビジネスレベル' }).kind, 'rirekisho');
  assert.equal(suggestFormat({ company: 'Sample', companyJa: 'サンプル', role: 'Backend Engineer (full-time)', language: 'Japanese N1' }).kind, 'shokumu');
  assert.equal(suggestFormat({ company: 'Lab', role: 'Research Intern', languageType: 'English-first' }).kind, 'cv');
});

test('year-month parsing', () => {
  assert.deepEqual(parseYearMonth('Apr 2024'), { year: '2024', month: '4', expected: false });
  assert.deepEqual(parseYearMonth('Mar 2028 (Expected)'), { year: '2028', month: '3', expected: true });
  assert.deepEqual(parseYearMonth('2023年6月'), { year: '2023', month: '6', expected: false });
  assert.equal(parseYearMonth('Present'), null);
});
