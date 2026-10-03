import test from 'node:test';
import assert from 'node:assert/strict';
import { companyGroupKey, sameCompany } from './companyGroup.js';

test('group suffixes collapse onto one company page', () => {
  assert.ok(sameCompany('Mercari Group', 'Mercari'));
  assert.ok(sameCompany('Rakuten Group, Inc.', 'Rakuten'));
  assert.ok(sameCompany('LINE Yahoo Corporation', 'LINE Yahoo'));
  assert.ok(sameCompany('HENNGE K.K.', 'HENNGE'));
});

test('Japanese corporate forms', () => {
  assert.ok(sameCompany('Sansan株式会社', 'Sansan'));
  assert.equal(companyGroupKey('株式会社メルカリ'), 'メルカリ');
});

test('different companies stay apart, and a lone suffix word survives', () => {
  assert.ok(!sameCompany('Money Forward', 'Forward'));
  assert.ok(!sameCompany('Mercari', 'Merpay'));
  assert.equal(companyGroupKey('Group'), 'group');
  assert.ok(!sameCompany('', ''));
});
