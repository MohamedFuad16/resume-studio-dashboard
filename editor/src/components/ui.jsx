import React, { useState, useRef, useEffect } from 'react';

/* ── Micro icon set ─────────────────────────────────────── */
export const I = ({ n, s = 14, style }) => {
  const d = {
    menu:   <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    user:   <><circle cx="12" cy="8" r="3.5"/><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6"/></>,
    edu:    <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>,
    work:   <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></>,
    code:   <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    zap:    <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    star:   <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    txt:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    file:   <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    dl:     <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    mail:   <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>,
    ai:     <><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M8 12h8"/></>,
    json:   <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    sync:   <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    plus:   <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x:      <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check:  <><polyline points="20 6 9 17 4 12"/></>,
    chev:   <><polyline points="6 9 12 15 18 9"/></>,
    radar:  <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/><line x1="12" y1="12" x2="19" y2="7"/></>,
    panel:  <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></>,
    // Sidebar collapse/expand: panel + a chevron showing which way it will move.
    collapse: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="15.5 9.5 13 12 15.5 14.5"/></>,
    brain:  <><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></>,
    sun:    <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>,
    moon:   <><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></>,
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d[n]}
    </svg>
  );
};

/* ── Toast ──────────────────────────────────────────────── */
export function Toasts({ list, dismiss }) {
  return (
    <div className="toast-tray">
      {list.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => dismiss(t.id)} data-testid={t.testId || (t.type === 'error' ? 'download-error-toast' : undefined)}>
          <I n={t.type === 'success' ? 'check' : t.type === 'error' ? 'x' : 'file'} s={12}
            style={{ color: t.type === 'success' ? 'var(--green)' : t.type === 'error' ? 'var(--err)' : 'var(--blue)', flexShrink: 0 }} />
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ── Export dropdown ────────────────────────────────────── */
export function ExportMenu({ onPDF, onTex, onJson, onAI, isJa = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const go = fn => { setOpen(false); fn(); };

  return (
    <div className="exp-wrap" ref={ref}>
      <button type="button" className="btn" onClick={() => setOpen(o => !o)}>
        <I n="dl" s={12} /> {isJa ? '書き出し' : 'Export'}
      </button>
      {open && (
        <div className="exp-menu">
          <button type="button" className="exp-item" onClick={() => go(onPDF)} data-testid="export-pdf-btn">
            <I n="file" s={12} style={{ color: 'var(--err)' }} />
            {isJa ? 'PDFをダウンロード' : 'Download PDF'}
            <span className="exp-sub">.pdf</span>
          </button>
          <button type="button" className="exp-item" onClick={() => go(onTex)} data-testid="export-tex-btn">
            <I n="txt" s={12} style={{ color: 'var(--amber)' }} />
            {isJa ? 'LaTeXソースをダウンロード' : 'Download LaTeX source'}
            <span className="exp-sub">.tex</span>
          </button>
          <button type="button" className="exp-item" onClick={() => go(onJson)} data-testid="export-json-btn">
            <I n="json" s={12} style={{ color: 'var(--blue)' }} />
            {isJa ? '元データをダウンロード' : 'Download raw data'}
            <span className="exp-sub">.json</span>
          </button>
          <div className="exp-sep" />
          <button type="button" className="exp-item" onClick={() => go(onAI)}>
            <I n="brain" s={12} style={{ color: 'var(--green)' }} />
            {isJa ? 'AI応募プロフィール' : 'AI Job Profile'}
            <span className="exp-sub">.md</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Section accordion ──────────────────────────────────── */
export function Sec({ icon, label, count, children, open: init = false, testId, hideHeader = false }) {
  const [open, setOpen] = useState(init);
  return (
    <div className="sec">
      {!hideHeader && (
        <div className="sec-hd" onClick={() => setOpen(o => !o)}>
          <span className="sec-icon"><I n={icon} s={13} /></span>
          <h2 className="sec-name" data-testid={testId} style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>{label}</h2>
          {count !== undefined && <span className="sec-badge">{count}</span>}
          <span className={`sec-chev ${open ? 'open' : ''}`}><I n="chev" s={11} /></span>
        </div>
      )}
      {open && <div className="sec-bd">{children}</div>}
    </div>
  );
}

/* ── Field primitives ───────────────────────────────────── */
export const Lbl = ({ t }) => <span className="fl">{t}</span>;

export function Inp({ label, value, onChange, placeholder, type = 'text', ...props }) {
  return (
    <div className="f">
      {label && <Lbl t={label} />}
      <input className="fi" type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} {...props} />
    </div>
  );
}

/* Shared auto-growing textarea: height tracks content (scrollHeight) on mount,
   on every value change, and on input. Brand-new behavior → inline height is set
   imperatively; the namespaced `.autosize-textarea` class hides the scrollbar/resize
   handle (see CSS SPEC). A min-height floor is supplied by the caller. */
function AutoTextarea({ value, onChange, className = '', style, ...props }) {
  const ref = useRef(null);
  const resize = el => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => { resize(ref.current); }, [value]);
  return (
    <textarea
      ref={ref}
      className={`autosize-textarea ${className}`.trim()}
      value={value || ''}
      onChange={e => { onChange(e.target.value); resize(e.target); }}
      style={style}
      {...props}
    />
  );
}

export function Txta({ label, value, onChange, placeholder, rows = 3, className = '', ...props }) {
  return (
    <div className="f">
      {label && <Lbl t={label} />}
      <AutoTextarea className={`fta ${className}`.trim()} value={value} onChange={onChange}
        placeholder={placeholder || ''} style={{ minHeight: `${rows * 20}px` }} {...props} />
    </div>
  );
}

/* ── Native month picker with optional "ongoing" toggle ──── */
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parse any stored date string ("Apr 2024", "2024-04", "2024年4月", …) → "YYYY-MM"
// for the native <input type="month"> value. Returns '' when no month is present.
export function toMonthValue(str) {
  if (!str) return '';
  const s = String(str).trim();
  const map = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  let m = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${String(Math.min(12, Math.max(1, +m[2]))).padStart(2, '0')}`;
  m = s.match(/^(\d{4})年\s*(\d{1,2})月/);
  if (m) return `${m[1]}-${String(Math.min(12, Math.max(1, +m[2]))).padStart(2, '0')}`;
  m = s.match(/^([A-Za-z]{3,})\s*(\d{4})/);
  if (m && map[m[1].toLowerCase().slice(0, 3)]) return `${m[2]}-${String(map[m[1].toLowerCase().slice(0, 3)]).padStart(2, '0')}`;
  m = s.match(/^(\d{4})\s*([A-Za-z]{3,})/);
  if (m && map[m[2].toLowerCase().slice(0, 3)]) return `${m[1]}-${String(map[m[2].toLowerCase().slice(0, 3)]).padStart(2, '0')}`;
  return '';
}

// "YYYY-MM" → canonical human display "Mon YYYY" (e.g. "Apr 2024"). Stored verbatim;
// the EN résumé template prints it as-is and the JA template re-parses it via parseDateJa.
export function formatMonthDisplay(yyyymm) {
  const m = String(yyyymm || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  return `${MONTHS_EN[Math.min(12, Math.max(1, +m[2])) - 1]} ${m[1]}`;
}

export function MonthInput({ label, value, onChange, ongoingMode, isJa = false, placeholder }) {
  const raw = (value || '').trim();
  const monthVal = toMonthValue(raw);
  const isPresent = /^(present|現在)$/i.test(raw);
  const isExpected = /\(expected\)|予定/i.test(raw);
  const ongoingOn = ongoingMode === 'present' ? isPresent : ongoingMode === 'expected' ? isExpected : false;

  const emit = (mv, ongoing) => {
    if (ongoingMode === 'present') {
      if (ongoing) return onChange('Present');
      return onChange(mv ? formatMonthDisplay(mv) : '');
    }
    if (ongoingMode === 'expected') {
      if (!mv) return onChange('');
      return onChange(formatMonthDisplay(mv) + (ongoing ? ' (Expected)' : ''));
    }
    return onChange(mv ? formatMonthDisplay(mv) : '');
  };

  const ongoingLabel = ongoingMode === 'present'
    ? (isJa ? '現在' : 'Present')
    : (isJa ? '卒業予定' : 'Expected');

  return (
    <div className="f month-field">
      {label && <Lbl t={label} />}
      <div className="month-field-row">
        <input
          className="fi month-input"
          type="month"
          value={monthVal}
          placeholder={placeholder || ''}
          disabled={ongoingMode === 'present' && ongoingOn}
          onChange={e => emit(e.target.value, ongoingOn)}
        />
        {ongoingMode && (
          <button
            type="button"
            className={`month-ongoing-toggle ${ongoingOn ? 'on' : ''}`}
            aria-pressed={ongoingOn}
            onClick={() => emit(monthVal, !ongoingOn)}
          >
            <span className="month-ongoing-check" aria-hidden="true"><I n="check" s={11} /></span>
            {ongoingLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Bullet list ────────────────────────────────────────── */
export function Bullets({ items, onChange }) {
  const upd = (i, v) => { const n = [...items]; n[i] = v; onChange(n); };
  const del = i => onChange(items.filter((_, x) => x !== i));
  const add = () => onChange([...items, '']);
  return (
    <div className="f">
      <Lbl t="Bullet points" />
      <div className="bullet-stack">
        {items.map((b, i) => (
          <div key={i} className="bullet-row">
            <AutoTextarea className="fta bullet-textarea" value={b} onChange={v => upd(i, v)}
              placeholder={`Point ${i + 1}…`} />
            <button type="button" className="bullet-del" onClick={() => del(i)} title="Remove">
              <I n="x" s={11} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-add-bullet" onClick={add}>+ Add point</button>
    </div>
  );
}

/* ── Multi-select Tag Input ──────────────────────────────── */
export function TagInput({ label, value, onChange, placeholder, suggestions = [] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const inputRef = useRef();



  const tags = value
    ? value.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    const handleOutside = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const addTag = tag => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      setQuery('');
      return;
    }
    const nextTags = [...tags, trimmed];
    onChange(nextTags.join(', '));
    setQuery('');
  };

  const removeTag = index => {
    const nextTags = tags.filter((_, i) => i !== index);
    onChange(nextTags.join(', '));
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim()) {
        addTag(query);
      }
    } else if (e.key === 'Backspace' && !query && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const filteredSuggestions = suggestions.filter(s => {
    const matchesQuery = s.toLowerCase().includes(query.toLowerCase());
    const isAlreadySelected = tags.some(t => t.toLowerCase() === s.toLowerCase());
    return matchesQuery && !isAlreadySelected;
  });
  const visibleSuggestions = filteredSuggestions.slice(0, 8);



  return (
    <div className="f tag-inp-container tag-multiselect" ref={ref}>
      {label && <Lbl t={label} />}
      <div
        className={`tag-inp-box tag-ms-box ${open ? 'focus' : ''}`}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <div className="tag-pills tag-ms-pills">
          {tags.map((tag, i) => (
            <span key={i} className="tag-pill">
              <span className="tag-pill-label">{tag}</span>
              <button type="button" className="tag-pill-remove" onClick={(e) => { e.stopPropagation(); removeTag(i); }}>
                <I n="x" s={10} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className="tag-inp-field tag-ms-field"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? (placeholder || 'Type or select...') : ''}
            onFocus={() => setOpen(true)}
          />
        </div>
        <button
          type="button"
          className="field-chevron"
          aria-label="Toggle options"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        >
          <I n="chev" s={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>
      {open && (filteredSuggestions.length > 0 || (query.trim() && !tags.some(t => t.toLowerCase() === query.trim().toLowerCase()))) && (
        <div className="tag-dropdown tag-ms-dropdown">
          {visibleSuggestions.map((s, idx) => (
            <div key={idx} className="tag-dropdown-item" onClick={() => addTag(s)}>
              {s}
            </div>
          ))}
          {query.trim() && !filteredSuggestions.some(s => s.toLowerCase() === query.trim().toLowerCase()) && !tags.some(t => t.toLowerCase() === query.trim().toLowerCase()) && (
            <div className="tag-dropdown-item tag-dropdown-add" onClick={() => addTag(query)}>
              Add &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Autocomplete / Suggestion Input ─────────────────────── */
export function SuggestInput({ label, value, onChange, placeholder, suggestions = [], ...props }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handleOutside = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes((value || '').toLowerCase())
  );

  return (
    <div className="f tag-inp-container suggest-field" ref={ref}>
      {label && <Lbl t={label} />}
      <div className={`tag-inp-box suggest-box ${open ? 'focus' : ''}`}>
        <input
          className="tag-inp-field suggest-input"
          type="text"
          value={value || ''}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || ''}
          {...props}
        />
        <button
          type="button"
          className="field-chevron"
          aria-label="Toggle suggestions"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        >
          <I n="chev" s={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="tag-dropdown suggest-dropdown">
          {filtered.map((s, idx) => (
            <div key={idx} className="tag-dropdown-item" onClick={() => { onChange(s); setOpen(false); }}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
