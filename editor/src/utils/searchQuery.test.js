import test from 'node:test';
import assert from 'node:assert/strict';
import { hasStructuredFilters, matchesParsedFilters, parseSearchQuery, withoutChips } from './searchQuery.js';

test("the owner's example parses into type, experience and field", () => {
  const { filters, chips } = parseSearchQuery('I want companies that have internships with no experience in AI engineering');
  assert.equal(filters.jobType, 'internship');
  assert.equal(filters.noExperience, true);
  assert.deepEqual(filters.fields, ['ai']);
  assert.deepEqual(filters.keywords, []);
  assert.deepEqual(chips.map(chip => chip.key), ['jobType', 'noExperience', 'field:ai']);
});

test('place, language and deadline', () => {
  const { filters } = parseSearchQuery('new grad backend roles in Tokyo, English OK, closing this month');
  assert.equal(filters.jobType, 'new_grad');
  assert.deepEqual(filters.fields, ['backend']);
  assert.equal(filters.city.en, 'Tokyo');
  assert.equal(filters.languageType, 'English-first');
  assert.equal(filters.deadlineDays, 30);
});

test('Japanese query', () => {
  const { filters } = parseSearchQuery('東京のAIインターン 未経験可 英語');
  assert.equal(filters.jobType, 'internship');
  assert.equal(filters.noExperience, true);
  assert.deepEqual(filters.fields, ['ai']);
  assert.equal(filters.city.ja, '東京');
  assert.equal(filters.languageType, 'English-first');
});

test('"no Japanese" means English-first, and remote wins over Japan', () => {
  const { filters } = parseSearchQuery('remote frontend internship in Japan, no Japanese');
  assert.equal(filters.region, 'Remote');
  assert.equal(filters.languageType, 'English-first');
});

test('a bare company name stays a keyword search', () => {
  const parsed = parseSearchQuery('mercari');
  assert.deepEqual(parsed.filters.keywords, ['mercari']);
  assert.equal(hasStructuredFilters(parsed), false);
  assert.equal(hasStructuredFilters(parseSearchQuery('mercari internship')), true);
});

test('"email" does not read as AI', () => {
  assert.deepEqual(parseSearchQuery('email marketing').filters.fields, []);
});

const mercari = {
  company: 'Mercari Group', role: 'Class of 2028 Software Engineer Internship', location: 'Roppongi, Tokyo / remote within Japan',
  city: 'Tokyo', languageType: 'English-first', track: 'Software Engineering', techStack: ['Go / Kotlin / Swift / TypeScript', 'Backend APIs'],
  eligibility: ['20+ hours per week', 'Product development and operations experience'], deadlineDate: null,
};
const aiIntern = {
  company: 'Example AI', role: 'Machine Learning Intern', location: 'Shibuya, Tokyo', city: 'Tokyo', languageType: 'English-first',
  track: 'AI / ML', eligibility: ['University students of any year', 'No prior experience required'], deadlineDate: '2026-10-20',
};

test('matching: type, field, place and experience', () => {
  const ai = parseSearchQuery('AI internships in Tokyo with no experience').filters;
  assert.equal(matchesParsedFilters(aiIntern, ai), true);
  assert.equal(matchesParsedFilters(mercari, ai), false); // no AI terms, and it asks for experience
});

test('matching: an experience line that waives itself does not exclude', () => {
  const filters = parseSearchQuery('internship no experience').filters;
  assert.equal(matchesParsedFilters(aiIntern, filters), true);
  assert.equal(matchesParsedFilters(mercari, filters), false);
});

test('matching: deadline window uses the date, undated listings drop out', () => {
  const filters = parseSearchQuery('internships closing this month').filters;
  const now = Date.parse('2026-10-03T00:00:00Z');
  assert.equal(matchesParsedFilters(aiIntern, filters, now), true);
  assert.equal(matchesParsedFilters(mercari, filters, now), false);
});

test('removing a chip removes its filter', () => {
  const parsed = parseSearchQuery('AI internships in Tokyo with no experience');
  const relaxed = withoutChips(parsed.filters, new Set(['noExperience', 'field:ai']));
  assert.equal(relaxed.noExperience, false);
  assert.deepEqual(relaxed.fields, []);
  assert.equal(matchesParsedFilters(mercari, relaxed), true);
});
