import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeParsedResume, parseResumeTextHeuristically } from './resumePdf.js';

// Shape of a real two-page résumé export: repeated page header, a wrapped intro
// sentence ending in "work.", and title / tech-stack / description project rows.
const TEXT = [
  'JANE DOE', 'Software Engineer Intern', '080-1234-5678 | Tokyo | github.com/janedoe',
  'SUMMARY', 'Third-year CS student who ships web apps.',
  'TECHNICAL PROFILE', 'Languages: TypeScript, Python',
  'EXPERIENCE', 'Acme Corp 2024 - 2025', 'Intern',
  'JANE DOE', 'Software Engineer Intern', '080-1234-5678 | Tokyo | github.com/janedoe',
  'SELECTED PROJECT PORTFOLIO', 'Selected builds across AI learning tools, university web apps, macOS utilities,', 'and shipped ecommerce work.',
  'Tutor-System', 'TypeScript, React, Express', 'Built an AI tutor for reading PDFs and',
  'reviewing concepts.', 'shop.example', 'Shopify, web design', 'Built a storefront.',
].join('\n');

test('parses contact, summary, and projects from a two-page export', () => {
  const r = parseResumeTextHeuristically(TEXT);
  assert.equal(r.personal.nameEn, 'JANE DOE');
  assert.equal(r.personal.phone, '080-1234-5678');
  assert.equal(r.summary, 'Third-year CS student who ships web apps.');
  assert.deepEqual(r.projects.map(p => [p.title, p.tech]), [
    ['Tutor-System', 'TypeScript, React, Express'],
    ['shop.example', 'Shopify, web design'],
  ]);
  const tutor = r.projects.find(p => p.title === 'Tutor-System');
  assert.deepEqual(tutor.bullets, ['Built an AI tutor for reading PDFs and reviewing concepts.']);
  assert.equal(r.experience.length, 1, 'the wrapped "work." line must not open an Experience section');
});

test('merge keeps fields the parse did not find', () => {
  const merged = mergeParsedResume(
    { personal: { nameJa: '山田', photoDataUrl: 'data:x', email: 'old@x.jp' }, projects: [{ id: 'p1', title: 'Kept' }] },
    { personal: { nameEn: 'Jane', email: '' }, projects: [], skills: { languages: '', tools: '' }, summary: '' },
  );
  assert.deepEqual(merged.personal, { nameJa: '山田', photoDataUrl: 'data:x', email: 'old@x.jp', nameEn: 'Jane' });
  assert.deepEqual(merged.projects, [{ id: 'p1', title: 'Kept' }]);
  assert.equal(merged.skills, undefined);
});

// Code review 2026-09-24: an upload used to replace whole sections, dropping
// companyJa / degreeJa / ids and saving invented "Specialist" / "Tokyo, Japan".
test('upload never drops stored entries or their Japanese fields', () => {
  const stored = {
    personal: {},
    experience: [{ id: 'e1', company: 'Acme', companyJa: 'アクメ', role: 'Engineer', roleJa: 'エンジニア', location: 'Osaka', startDate: '2023', endDate: '2024', bullets: ['Shipped X.'] }],
    education: [{ id: 'd1', institution: 'Tokai University', institutionJa: '東海大学', degree: 'B.Eng', degreeJa: '情報工学' }],
    skills: { languages: 'Go' },
    summary: 'Mine.',
  };
  const parsed = parseResumeTextHeuristically(['JANE', 'EXPERIENCE', 'Acme 2023 - 2024', 'NewCo Inc. 2025', 'EDUCATION', 'Tokai University 2024', 'SKILLS', 'Languages: Rust', 'SUMMARY', 'Theirs.'].join('\n'));
  const merged = mergeParsedResume(stored, parsed);
  const acme = merged.experience.find(e => e.id === 'e1');
  assert.equal(acme.companyJa, 'アクメ');
  assert.equal(acme.role, 'Engineer');
  assert.equal(acme.location, 'Osaka');
  assert.ok(merged.experience.some(e => /NewCo/.test(e.company)), 'new job is appended');
  assert.ok(merged.experience.every(e => e.role !== 'Specialist' && e.location !== 'Tokyo, Japan'));
  assert.equal(merged.education.length, 1);
  assert.equal(merged.education[0].degreeJa, '情報工学');
  assert.equal(merged.skills.languages, 'Go');
  assert.equal(merged.summary, 'Mine.');
});

// Second review 2026-09-24: activities never matched (wrong field names) and a
// legacy array of skills was replaced; "Languages: …" was eaten as a heading.
test('re-uploading does not duplicate activities', () => {
  const text = ['JANE', 'ACTIVITIES', 'JLPT N2 Certification 2024', 'Hackathon Winner 2025'].join('\n');
  const once = mergeParsedResume({ personal: {}, activities: [{ id: 'a1', title: 'JLPT N2 Certification 2024', org: 'JEES' }] }, parseResumeTextHeuristically(text));
  const twice = mergeParsedResume(once, parseResumeTextHeuristically(text));
  assert.equal(twice.activities.length, 2);
  assert.ok(twice.activities.every(a => typeof a.title === 'string' && a.title));
  assert.equal(twice.activities.find(a => a.id === 'a1').org, 'JEES');
});

test('a stored list of skills survives an upload', () => {
  const parsed = parseResumeTextHeuristically(['JANE', 'SKILLS', 'Languages: Python, Go'].join('\n'));
  assert.equal(parsed.skills.languages, 'Python, Go');
  const merged = mergeParsedResume({ personal: {}, skills: ['Swift', 'SwiftUI'] }, parsed);
  assert.deepEqual(merged.skills, ['Swift', 'SwiftUI']);
  assert.equal(mergeParsedResume({ personal: {}, skills: [] }, parsed).skills.languages, 'Python, Go');
});
