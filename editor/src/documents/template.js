// One HTML document per résumé / CV / 履歴書 / 職務経歴書 / cover letter. The app
// previews exactly this HTML in an iframe, and phase 2's server prints the same
// string to PDF with headless Chromium, so the preview is the PDF.
//
// Every value is HTML-escaped: document text comes from the user and from an
// LLM, and the preview iframe would otherwise run whatever it contained.
//
// Pure module: no React, no I/O. Tested by template.test.js.

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const e = escapeHtml;
// Only http(s) and mailto links survive; anything else (javascript:, data:) is dropped.
const safeUrl = url => (/^(https?:|mailto:)/i.test(String(url || '').trim()) ? String(url).trim() : '');
const lines = text => e(text).replace(/\n/g, '<br>');

const BASE_CSS = `
  @page { size: A4; margin: 14mm 15mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { color: #14161a; font: 10pt/1.45 "Helvetica Neue", Arial, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body.ja { font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif; font-size: 10pt; }
  .page { width: 100%; max-width: 180mm; margin: 0 auto; }
  a { color: inherit; text-decoration: none; }
  h1 { margin: 0; font-size: 20pt; font-weight: 700; letter-spacing: -0.01em; }
  h2 { margin: 14pt 0 5pt; padding-bottom: 2pt; border-bottom: 0.8pt solid #14161a; font-size: 9.5pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  body.ja h2 { letter-spacing: 0.02em; text-transform: none; }
  .contact { margin-top: 4pt; color: #3d434d; font-size: 8.8pt; }
  .contact span + span::before { content: " · "; color: #8a909a; }
  .summary { margin: 8pt 0 0; }
  .item { margin: 0 0 7pt; break-inside: avoid; }
  .item-top { display: flex; justify-content: space-between; gap: 10pt; }
  .item-top b { font-size: 10pt; }
  .item-top span { flex: none; color: #3d434d; font-size: 8.8pt; }
  .item-sub { color: #3d434d; font-size: 9pt; }
  ul { margin: 2pt 0 0; padding-left: 13pt; }
  li { margin: 1pt 0; }
  .skills { display: grid; grid-template-columns: 30mm 1fr; gap: 2pt 8pt; }
  .skills b { font-weight: 600; }
`;

const RIREKISHO_CSS = `
  body { font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif; font-size: 10pt; }
  .r-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 4pt; }
  .r-head h1 { font-size: 18pt; letter-spacing: 0.6em; }
  .r-date { font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 0.8pt solid #14161a; padding: 4pt 6pt; vertical-align: top; text-align: left; font-weight: 400; }
  .r-top { display: grid; grid-template-columns: 1fr 30mm; gap: 6pt; }
  .r-photo { height: 40mm; border: 0.8pt dashed #6b717c; display: flex; align-items: center; justify-content: center; color: #6b717c; font-size: 8pt; text-align: center; }
  .label { width: 22mm; font-size: 8pt; color: #3d434d; }
  .kana { font-size: 8pt; }
  .name { font-size: 16pt; }
  .hist th { font-size: 8pt; text-align: center; }
  .hist .y { width: 16mm; text-align: center; }
  .hist .m { width: 10mm; text-align: center; }
  .hist .center { text-align: center; }
  .hist .right { text-align: right; }
  .box { min-height: 26mm; white-space: pre-wrap; }
  .section-label { margin: 9pt 0 3pt; font-size: 9pt; }
`;

const LETTER_CSS = `
  .letter { font-size: 10.5pt; line-height: 1.7; }
  body.ja .letter { font-size: 10.5pt; }
  .from { text-align: right; color: #3d434d; font-size: 9pt; }
  .date { margin: 12pt 0; text-align: right; }
  .to { margin-bottom: 14pt; white-space: pre-wrap; }
  .letter p { margin: 0 0 9pt; }
  .closing { margin-top: 16pt; }
  body.ja .closing { text-align: right; }
`;

function shell({ lang, title, css, body }) {
  return `<!doctype html><html lang="${lang === 'ja' ? 'ja' : 'en'}"><head><meta charset="utf-8"><title>${e(title)}</title><style>${BASE_CSS}${css || ''}</style></head><body class="${lang === 'ja' ? 'ja' : 'en'}"><div class="page">${body}</div></body></html>`;
}

function contactLine(h) {
  const parts = [h.email, h.phone, h.address].filter(Boolean).map(value => `<span>${e(value)}</span>`);
  for (const link of h.links || []) {
    const url = safeUrl(link.url);
    parts.push(`<span>${url ? `<a href="${e(url)}">${e(link.label)}</a>` : e(link.label)}</span>`);
  }
  return parts.join('');
}

function sectionHtml(section) {
  if (section.type === 'skills') {
    return `<h2>${e(section.title)}</h2><div class="skills">${section.items.map(item => `<b>${e(item.heading)}</b><span>${e(item.bullets.join(', '))}</span>`).join('')}</div>`;
  }
  const items = section.items.map(item => {
    const heading = item.heading || item.subheading || item.meta
      ? `<div class="item-top"><b>${e(item.heading)}</b>${item.meta ? `<span>${e(item.meta)}</span>` : ''}</div>${item.subheading ? `<div class="item-sub">${e(item.subheading)}</div>` : ''}`
      : '';
    const bullets = section.type === 'text'
      ? item.bullets.map(text => `<p class="summary">${lines(text)}</p>`).join('')
      : (item.bullets.length ? `<ul>${item.bullets.map(text => `<li>${e(text)}</li>`).join('')}</ul>` : '');
    return `<div class="item">${heading}${bullets}</div>`;
  }).join('');
  return `<h2>${e(section.title)}</h2>${items}`;
}

function resumeHtml(doc) {
  const h = doc.header;
  const summaryTitle = doc.lang === 'ja' ? (doc.kind === 'shokumu' ? '職務要約' : '概要') : 'Summary';
  const top = doc.kind === 'shokumu'
    ? `<div style="text-align:center"><h1 style="letter-spacing:0.3em">職務経歴書</h1></div><div class="contact" style="text-align:right">${e(todayJa())}現在<br>氏名\u3000${e(h.name)}</div>`
    : `<h1>${e(h.name)}</h1>${h.nameAlt ? `<div class="item-sub">${e(h.nameAlt)}</div>` : ''}<div class="contact">${contactLine(h)}</div>`;
  const summary = doc.summary ? `<h2>${e(summaryTitle)}</h2><p class="summary">${lines(doc.summary)}</p>` : '';
  return top + summary + doc.sections.map(sectionHtml).join('');
}

function todayJa() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function rirekishoHtml(doc) {
  const h = doc.header;
  const r = doc.rirekisho;
  const histRow = row => {
    if (row.heading) return `<tr><td class="y"></td><td class="m"></td><td class="center">${e(row.text)}</td></tr>`;
    if (row.end) return `<tr><td class="y"></td><td class="m"></td><td class="right">${e(row.text)}</td></tr>`;
    return `<tr><td class="y">${e(row.year)}</td><td class="m">${e(row.month)}</td><td>${e(row.text)}</td></tr>`;
  };
  const licenseRows = r.licenses.length
    ? r.licenses.map(row => `<tr><td class="y">${e(row.year)}</td><td class="m">${e(row.month)}</td><td>${e(row.text)}</td></tr>`).join('')
    : '<tr><td class="y"></td><td class="m"></td><td>特になし</td></tr>';
  return `
    <div class="r-head"><h1>履歴書</h1><span class="r-date">${e(todayJa())}現在</span></div>
    <div class="r-top">
      <table>
        <tr><td class="label">ふりがな</td><td class="kana">${e(h.kana)}</td></tr>
        <tr><td class="label">氏名</td><td class="name">${e(h.name)}</td></tr>
        <tr><td class="label">生年月日</td><td>${e(h.dob)}</td></tr>
        <tr><td class="label">現住所</td><td>${h.postalCode ? `〒${e(h.postalCode)}<br>` : ''}${e(h.address)}</td></tr>
        <tr><td class="label">連絡先</td><td>${[h.phone, h.email].filter(Boolean).map(e).join('<br>')}</td></tr>
      </table>
      <div class="r-photo">写真<br>縦4cm×横3cm</div>
    </div>
    <p class="section-label">学歴・職歴</p>
    <table class="hist"><tr><th class="y">年</th><th class="m">月</th><th>学歴・職歴</th></tr>${r.rows.map(histRow).join('')}</table>
    <p class="section-label">免許・資格</p>
    <table class="hist"><tr><th class="y">年</th><th class="m">月</th><th>免許・資格</th></tr>${licenseRows}</table>
    <p class="section-label">志望動機</p>
    <table><tr><td class="box">${lines(r.motivation)}</td></tr></table>
    <p class="section-label">自己PR</p>
    <table><tr><td class="box">${lines(r.selfPr)}</td></tr></table>
    <p class="section-label">本人希望記入欄</p>
    <table><tr><td class="box" style="min-height:14mm">${lines(r.requests)}</td></tr></table>`;
}

function letterHtml(doc) {
  const h = doc.header;
  const l = doc.letter;
  return `<div class="letter">
    <div class="from">${e(h.name)}<br>${[h.email, h.phone].filter(Boolean).map(e).join('<br>')}</div>
    <div class="date">${e(l.date)}</div>
    <div class="to">${e(l.recipient)}</div>
    <p>${e(l.greeting)}</p>
    ${l.paragraphs.map(text => `<p>${lines(text)}</p>`).join('')}
    <div class="closing">${e(l.closing)}<br>${e(l.signature)}</div>
  </div>`;
}

const KIND_TITLE = { resume: 'Resume', cv: 'CV', rirekisho: '履歴書', shokumu: '職務経歴書', cover_letter: 'Cover letter' };

// The print dialog suggests the document title as the PDF's file name.
export function documentFileTitle(doc) {
  return [doc.header?.name, KIND_TITLE[doc.kind] || 'Document', doc.target?.company].filter(Boolean).join(' - ');
}

export function renderDocumentHtml(doc) {
  const title = documentFileTitle(doc);
  if (doc.kind === 'rirekisho' && doc.rirekisho) return shell({ lang: 'ja', title, css: RIREKISHO_CSS, body: rirekishoHtml(doc) });
  if (doc.kind === 'cover_letter' && doc.letter) return shell({ lang: doc.lang, title, css: LETTER_CSS, body: letterHtml(doc) });
  return shell({ lang: doc.lang, title, body: resumeHtml(doc) });
}
