import test from 'node:test';
import assert from 'node:assert/strict';
import { documentFileTitle, escapeHtml, renderDocumentHtml } from './template.js';

const doc = {
  kind: 'resume', lang: 'en', target: { company: 'Acme' },
  header: { name: 'Ada <b>Lovelace</b>', email: 'ada@example.com', phone: '', address: '', links: [{ label: 'evil', url: 'javascript:alert(1)' }, { label: 'github.com/ada', url: 'https://github.com/ada' }] },
  summary: 'Builds things.<script>alert("x")</script>',
  sections: [{ id: 'projects', type: 'projects', title: 'Projects', items: [{ id: 'p1', heading: 'Engine', subheading: 'C++', meta: '2025', bullets: ['Wrote <img src=x onerror=alert(1)>'] }] }],
};

test('user and model text is escaped, never markup', () => {
  const html = renderDocumentHtml(doc);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Ada &lt;b&gt;Lovelace&lt;/b&gt;'));
});

test('only http(s) and mailto links survive', () => {
  const html = renderDocumentHtml(doc);
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('href="https://github.com/ada"'));
});

test('the print title becomes the PDF file name', () => {
  assert.equal(documentFileTitle({ ...doc, header: { name: 'Ada' } }), 'Ada - Resume - Acme');
  assert.ok(renderDocumentHtml(doc).includes('<title>Ada &lt;b&gt;Lovelace&lt;/b&gt; - Resume - Acme</title>'));
});

test('each kind renders a full A4 document', () => {
  const rirekisho = renderDocumentHtml({ ...doc, kind: 'rirekisho', lang: 'ja', rirekisho: { rows: [{ year: '2024', month: '4', text: '東海大学 入学' }, { text: '以上', end: true }], licenses: [], motivation: '', selfPr: '', requests: '貴社規定に従います。' } });
  assert.ok(rirekisho.includes('履歴書') && rirekisho.includes('東海大学 入学') && rirekisho.includes('特になし'));
  const letter = renderDocumentHtml({ ...doc, kind: 'cover_letter', letter: { date: '3 October 2026', recipient: 'Hiring Team\nAcme', greeting: 'Dear Hiring Team,', paragraphs: ['Hello <there>'], closing: 'Sincerely,', signature: 'Ada' } });
  assert.ok(letter.includes('Hello &lt;there&gt;'));
  for (const html of [rirekisho, letter, renderDocumentHtml(doc)]) assert.ok(html.includes('@page { size: A4;'));
});

test('escapeHtml covers the five characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});
