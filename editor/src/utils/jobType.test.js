import test from 'node:test';
import assert from 'node:assert/strict';
import { filterByJobType, inferJobType, jobTypeCounts, jobTypeLabel } from './jobType.js';

test('an explicit jobType wins over the role text', () => {
  assert.equal(inferJobType({ role: 'Software Engineer Intern', jobType: 'new_grad' }), 'new_grad');
});

test('internship markers in EN and JA', () => {
  assert.equal(inferJobType({ role: 'Global Internship Program Front-End Pathway' }), 'internship');
  assert.equal(inferJobType({ role: 'Software Engineer Intern (Backend)' }), 'internship');
  assert.equal(inferJobType({ role: '夏季インターンシップ（エンジニア）' }), 'internship');
  assert.equal(inferJobType({ role: 'TECH Camp - Applications Engineering' }), 'internship');
  assert.equal(inferJobType({ role: 'Software Engineering Co-op' }), 'internship');
  assert.equal(inferJobType({ role: 'Data Science Coop - Test Automation' }), 'internship');
});

test('"Class of 2028 ... Internship" is an internship, not new grad', () => {
  assert.equal(inferJobType({ role: 'Class of 2028 Software Engineer Internship' }), 'internship');
});

test('new-grad markers in EN and JA', () => {
  assert.equal(inferJobType({ role: 'Software Engineer, New Grad 2027' }), 'new_grad');
  assert.equal(inferJobType({ role: '2027卒 新卒採用 エンジニア職' }), 'new_grad');
  assert.equal(inferJobType({ role: '27卒 総合職' }), 'new_grad');
  assert.equal(inferJobType({ role: 'Class of 2027 Graduate Program' }), 'new_grad');
});

test('the email subject decides a vague Gmail role', () => {
  assert.equal(inferJobType({ role: 'Engineer', sourceMeta: { subject: '【27卒】エントリーありがとうございます' } }), 'new_grad');
  assert.equal(inferJobType({ role: 'Engineer', sourceMeta: { subject: 'Your summer internship application' } }), 'internship');
});

test('a real role with no markers is full time; no role is unsorted', () => {
  assert.equal(inferJobType({ role: 'Backend Engineer' }), 'full_time');
  assert.equal(inferJobType({ role: 'Senior iOS Engineer' }), 'full_time');
  assert.equal(inferJobType({ role: 'Application' }), 'unknown');
  assert.equal(inferJobType({ role: '' }), 'unknown');
  assert.equal(inferJobType(null), 'unknown');
});

test('schema.org employmentType is honoured', () => {
  assert.equal(inferJobType({ role: 'Software Engineer', employmentType: 'INTERN' }), 'internship');
});

test('counts and filter agree with inference', () => {
  const records = [
    { role: 'Data Science Intern' },
    { role: '新卒エンジニア' },
    { role: 'Platform Engineer' },
    { role: 'Application' },
  ];
  assert.deepEqual(jobTypeCounts(records), { all: 4, internship: 1, new_grad: 1, full_time: 1, unknown: 1 });
  assert.equal(filterByJobType(records, 'new_grad').length, 1);
  assert.equal(filterByJobType(records, 'all').length, 4);
});

test('labels in both languages', () => {
  assert.equal(jobTypeLabel('new_grad'), 'New grad');
  assert.equal(jobTypeLabel('new_grad', true), '新卒');
  assert.equal(jobTypeLabel('bogus'), 'Unsorted');
});
