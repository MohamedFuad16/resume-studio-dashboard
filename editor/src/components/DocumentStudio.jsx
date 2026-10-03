// Document studio (rebuild U4): "Create a résumé for this role". Step one picks
// the document and language, with the AI's suggestion on top. Step two is an
// editor beside a live A4 preview; the preview is the exact HTML the PDF is
// printed from (documents/template.js), so what you see is what downloads.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, FileText, Languages, LoaderCircle, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { documentsApi, isSampleData } from '../api/v2/index.js';
import { DOCUMENT_KINDS, JAPANESE_ONLY, KIND_LABELS, masterProfileFromResume } from '../documents/tailor.js';
import { documentFileTitle, renderDocumentHtml } from '../documents/template.js';
import { displayCompany, displayRole } from '../utils/internshipDisplay.js';

const COPY = {
  en: {
    title: (kind, role, company) => `${kind} for ${[role, company].filter(Boolean).join(' at ')}`,
    titleGeneric: 'Create a document',
    suggested: 'Suggested',
    useSuggestion: 'Use this',
    document: 'Document',
    language: 'Language',
    jaOnly: 'This form is always written in Japanese.',
    generate: 'Create draft',
    generating: 'Writing the draft…',
    sampleNote: 'Sample draft: picked and ordered from your profile only. Once the AI is connected it rewrites each line for this role in STAR form.',
    translateNote: 'Some lines have no Japanese version in your profile yet, so they are still in English. Edit them here, or the AI translates them once connected.',
    summary: 'Summary',
    heading: 'Title',
    subheading: 'Organisation / detail',
    meta: 'Dates',
    bullets: 'Lines (one per line)',
    addBullet: 'Add a line',
    removeItem: 'Remove this entry',
    letter: { date: 'Date', recipient: 'To', greeting: 'Greeting', paragraph: n => `Paragraph ${n}`, closing: 'Closing', signature: 'Signature' },
    rirekisho: { rows: 'Education and work history', year: 'Year', month: 'Month', text: 'Entry', motivation: 'Motivation (志望動機)', motivationHint: 'Write why you want this company. The AI drafts this once connected.', selfPr: 'Self-PR (自己PR)', requests: 'Requests (本人希望記入欄)', licenses: 'Licences and qualifications' },
    back: 'Back to options',
    save: 'Save draft',
    saved: 'Saved',
    download: 'Download PDF',
    printNote: 'Your browser\'s print dialog opens. Choose "Save as PDF".',
    close: 'Close',
    preview: 'Preview',
    error: 'Could not create the draft.',
  },
  ja: {
    title: (kind, role, company) => `${company ? `${company}・` : ''}${role || ''}向け${kind}`,
    titleGeneric: '書類を作成',
    suggested: 'おすすめ',
    useSuggestion: 'これを使う',
    document: '書類の種類',
    language: '言語',
    jaOnly: 'この書類は日本語で作成します。',
    generate: '下書きを作成',
    generating: '下書きを作成中…',
    sampleNote: 'サンプルの下書きです。プロフィールの内容を選んで並べただけです。AI接続後は、この募集に合わせて各項目をSTAR形式で書き直します。',
    translateNote: 'プロフィールに日本語版がない項目は英語のままです。ここで編集するか、AI接続後に翻訳されます。',
    summary: '概要',
    heading: '見出し',
    subheading: '所属・詳細',
    meta: '期間',
    bullets: '内容（1行に1項目）',
    addBullet: '行を追加',
    removeItem: 'この項目を削除',
    letter: { date: '日付', recipient: '宛先', greeting: '頭語', paragraph: n => `本文 ${n}`, closing: '結語', signature: '署名' },
    rirekisho: { rows: '学歴・職歴', year: '年', month: '月', text: '内容', motivation: '志望動機', motivationHint: 'この企業を志望する理由を書いてください。AI接続後は下書きを作成します。', selfPr: '自己PR', requests: '本人希望記入欄', licenses: '免許・資格' },
    back: '選択に戻る',
    save: '下書きを保存',
    saved: '保存しました',
    download: 'PDFをダウンロード',
    printNote: '印刷ダイアログが開きます。「PDFとして保存」を選んでください。',
    close: '閉じる',
    preview: 'プレビュー',
    error: '下書きを作成できませんでした。',
  },
};

// Print the document's HTML through a hidden frame. The frame has no
// allow-scripts: the HTML is escaped and never needs to run anything.
function printHtml(html) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('sandbox', 'allow-modals allow-same-origin');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
  };
  document.body.appendChild(frame);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A4 preview scaled to the column it sits in (794 x 1123 CSS px at 96 dpi).
function A4Preview({ html, label }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / 794)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="studio-preview" ref={wrapRef} style={{ height: `${Math.round(1123 * scale)}px` }}>
      <iframe title={label} sandbox="" srcDoc={html} style={{ transform: `scale(${scale})` }} />
    </div>
  );
}

const linesToList = text => String(text || '').split('\n').map(line => line.trim()).filter(Boolean);

export default function DocumentStudio({ target, resume, isJa = false, onClose }) {
  const t = COPY[isJa ? 'ja' : 'en'];
  const job = useMemo(() => target?.job || target?.doc?.target || {}, [target]);
  const profile = useMemo(() => masterProfileFromResume(resume), [resume]);
  const suggestion = useMemo(() => documentsApi.suggest(job, profile), [job, profile]);
  const [kind, setKind] = useState(target?.kind || target?.doc?.kind || suggestion.kind);
  const [lang, setLang] = useState(target?.doc?.lang || suggestion.lang);
  const [doc, setDoc] = useState(target?.doc || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [note, setNote] = useState('');
  const effectiveLang = JAPANESE_ONLY.has(kind) ? 'ja' : lang;
  const html = useMemo(() => (doc ? renderDocumentHtml(doc) : ''), [doc]);

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      setDoc(await documentsApi.generate({ resume, job, lang: effectiveLang, kind }));
      setSavedAt('');
    } catch (err) {
      setError(err?.message || t.error);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      setDoc(await documentsApi.save(doc));
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err?.message || t.error);
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    if (!doc) return;
    setError('');
    try {
      const result = await documentsApi.pdf(doc, html);
      if (result?.mode === 'blob' && result.blob) downloadBlob(result.blob, documentFileTitle(doc));
      else { setNote(t.printNote); printHtml(html); }
    } catch (err) {
      setError(err?.message || t.error);
    }
  };

  // Immutable edits on the draft; every change re-renders the preview.
  const edit = fn => { setDoc(current => fn(structuredClone(current))); setSavedAt(''); };
  const setItem = (sectionIndex, itemIndex, patch) => edit(d => { Object.assign(d.sections[sectionIndex].items[itemIndex], patch); return d; });
  const removeItem = (sectionIndex, itemIndex) => edit(d => { d.sections[sectionIndex].items.splice(itemIndex, 1); return d; });

  const kindLabel = value => (isJa ? KIND_LABELS[value].ja : KIND_LABELS[value].en);
  const heading = job.company || job.role
    ? t.title(kindLabel(kind), displayRole(job.role, isJa), displayCompany(job, isJa))
    : t.titleGeneric;

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className={`modal-card studio ${doc ? 'editing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="studio-title" onClick={event => event.stopPropagation()}>
        <div className="modal-hd">
          <h3 id="studio-title"><FileText size={16} /> {heading}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t.close}><X size={16} /></button>
        </div>

        {!doc ? (
          <div className="modal-bd studio-options">
            <div className="studio-suggestion">
              <Sparkles size={16} />
              <div>
                <b>{t.suggested}: {kindLabel(suggestion.kind)} · {suggestion.lang === 'ja' ? '日本語' : 'English'}</b>
                <span>{isJa ? suggestion.reason.ja : suggestion.reason.en}</span>
              </div>
              <button type="button" onClick={() => { setKind(suggestion.kind); setLang(suggestion.lang); }}>{t.useSuggestion}</button>
            </div>

            <fieldset className="studio-field">
              <legend>{t.document}</legend>
              <div className="studio-kinds">
                {DOCUMENT_KINDS.map(value => (
                  <label key={value} className={`studio-kind ${kind === value ? 'active' : ''}`}>
                    <input type="radio" name="studio-kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                    <span>{kindLabel(value)}</span>
                    {value === suggestion.kind ? <small>{t.suggested}</small> : null}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="studio-field">
              <legend><Languages size={14} /> {t.language}</legend>
              <div className="jobtype-tabs" role="radiogroup" aria-label={t.language}>
                {[['en', 'English'], ['ja', '日本語']].map(([value, label]) => (
                  <button key={value} type="button" role="radio" aria-checked={effectiveLang === value} className={`jobtype-tab ${effectiveLang === value ? 'active' : ''}`} disabled={JAPANESE_ONLY.has(kind) && value === 'en'} onClick={() => setLang(value)}>{label}</button>
                ))}
              </div>
              {JAPANESE_ONLY.has(kind) ? <small className="studio-hint">{t.jaOnly}</small> : null}
            </fieldset>

            {error ? <div className="settings-error" role="alert">{error}</div> : null}
            <div className="studio-actions">
              <button type="button" className="company-action primary" onClick={generate} disabled={busy}>
                {busy ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />} {busy ? t.generating : t.generate}
              </button>
            </div>
          </div>
        ) : (
          <div className="studio-edit">
            <div className="studio-form">
              {doc.source === 'sample' || isSampleData ? <p className="studio-banner">{t.sampleNote}</p> : null}
              {doc.needsTranslation ? <p className="studio-banner warn">{t.translateNote}</p> : null}

              {doc.letter ? (
                <div className="studio-group">
                  <label className="studio-input"><span>{t.letter.date}</span><input value={doc.letter.date} onChange={event => edit(d => { d.letter.date = event.target.value; return d; })} /></label>
                  <label className="studio-input"><span>{t.letter.recipient}</span><textarea rows={2} value={doc.letter.recipient} onChange={event => edit(d => { d.letter.recipient = event.target.value; return d; })} /></label>
                  <label className="studio-input"><span>{t.letter.greeting}</span><input value={doc.letter.greeting} onChange={event => edit(d => { d.letter.greeting = event.target.value; return d; })} /></label>
                  {doc.letter.paragraphs.map((text, index) => (
                    <label className="studio-input" key={index}><span>{t.letter.paragraph(index + 1)}</span><textarea rows={4} value={text} onChange={event => edit(d => { d.letter.paragraphs[index] = event.target.value; return d; })} /></label>
                  ))}
                  <button type="button" className="studio-mini" onClick={() => edit(d => { d.letter.paragraphs.push(''); return d; })}><Plus size={12} /> {t.letter.paragraph(doc.letter.paragraphs.length + 1)}</button>
                  <label className="studio-input"><span>{t.letter.closing}</span><input value={doc.letter.closing} onChange={event => edit(d => { d.letter.closing = event.target.value; return d; })} /></label>
                  <label className="studio-input"><span>{t.letter.signature}</span><input value={doc.letter.signature} onChange={event => edit(d => { d.letter.signature = event.target.value; return d; })} /></label>
                </div>
              ) : null}

              {doc.rirekisho ? (
                <div className="studio-group">
                  <b className="studio-group-title">{t.rirekisho.rows}</b>
                  <div className="studio-rows">
                    {doc.rirekisho.rows.map((row, index) => (
                      <div className={`studio-row ${row.heading || row.end ? 'is-fixed' : ''}`} key={index}>
                        <input aria-label={t.rirekisho.year} value={row.year} disabled={row.heading || row.end} onChange={event => edit(d => { d.rirekisho.rows[index].year = event.target.value; return d; })} />
                        <input aria-label={t.rirekisho.month} value={row.month} disabled={row.heading || row.end} onChange={event => edit(d => { d.rirekisho.rows[index].month = event.target.value; return d; })} />
                        <input aria-label={t.rirekisho.text} value={row.text} onChange={event => edit(d => { d.rirekisho.rows[index].text = event.target.value; return d; })} />
                      </div>
                    ))}
                  </div>
                  <label className="studio-input"><span>{t.rirekisho.motivation}</span><textarea rows={5} placeholder={t.rirekisho.motivationHint} value={doc.rirekisho.motivation} onChange={event => edit(d => { d.rirekisho.motivation = event.target.value; return d; })} /></label>
                  <label className="studio-input"><span>{t.rirekisho.selfPr}</span><textarea rows={5} value={doc.rirekisho.selfPr} onChange={event => edit(d => { d.rirekisho.selfPr = event.target.value; return d; })} /></label>
                  <label className="studio-input"><span>{t.rirekisho.requests}</span><input value={doc.rirekisho.requests} onChange={event => edit(d => { d.rirekisho.requests = event.target.value; return d; })} /></label>
                </div>
              ) : null}

              {!doc.letter && !doc.rirekisho ? (
                <label className="studio-input"><span>{t.summary}</span><textarea rows={4} value={doc.summary} onChange={event => edit(d => { d.summary = event.target.value; return d; })} /></label>
              ) : null}

              {doc.sections.map((section, sectionIndex) => (
                <div className="studio-group" key={section.id}>
                  <b className="studio-group-title">{section.title}</b>
                  {section.items.map((item, itemIndex) => (
                    <div className={`studio-item ${item.untranslated ? 'untranslated' : ''}`} key={item.id}>
                      {section.type !== 'text' ? (
                        <div className="studio-item-head">
                          <input aria-label={t.heading} value={item.heading} onChange={event => setItem(sectionIndex, itemIndex, { heading: event.target.value })} />
                          {section.type !== 'skills' ? <input aria-label={t.meta} className="meta" value={item.meta} onChange={event => setItem(sectionIndex, itemIndex, { meta: event.target.value })} /> : null}
                          <button type="button" className="studio-icon" onClick={() => removeItem(sectionIndex, itemIndex)} aria-label={t.removeItem} title={t.removeItem}><Trash2 size={13} /></button>
                        </div>
                      ) : null}
                      {section.type !== 'skills' && section.type !== 'text' ? (
                        <input aria-label={t.subheading} className="sub" value={item.subheading} onChange={event => setItem(sectionIndex, itemIndex, { subheading: event.target.value })} />
                      ) : null}
                      <textarea
                        aria-label={t.bullets}
                        rows={Math.min(8, Math.max(2, item.bullets.length + 1))}
                        value={section.type === 'skills' ? item.bullets.join(', ') : item.bullets.join('\n')}
                        onChange={event => setItem(sectionIndex, itemIndex, { bullets: section.type === 'skills' ? event.target.value.split(/\s*,\s*/).filter(Boolean) : linesToList(event.target.value), untranslated: false })}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="studio-side">
              <span className="studio-side-label">{t.preview}</span>
              <A4Preview html={html} label={t.preview} />
            </div>

            <div className="studio-footer">
              <button type="button" className="company-action" onClick={() => setDoc(null)} disabled={busy}><ArrowLeft size={14} /> {t.back}</button>
              <span className="studio-footer-note">{error || note}</span>
              <button type="button" className="company-action" onClick={save} disabled={busy}><Save size={14} /> {savedAt ? t.saved : t.save}</button>
              <button type="button" className="company-action primary" onClick={download} disabled={busy}><Download size={14} /> {t.download}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
