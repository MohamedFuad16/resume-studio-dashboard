// Debounce helper
export function debounce(fn, delay) {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => {
    clearTimeout(t);
    t = null;
  };
  debounced.flush = (...args) => {
    clearTimeout(t);
    t = null;
    return fn(...args);
  };
  return debounced;
}


// Stable per-item id for résumé section entries (education/experience/projects/
// activities) — React list keys need identity that survives reorder/edit, and
// the content itself can be blank or duplicated. Persisted with the résumé;
// the server round-trips unknown per-item fields and LaTeX generation ignores it.
export const newItemId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const TEMPLATES = [
  { id: 'en_01', label: "Jake's Clean",   lang: 'en' },
  { id: 'en_02', label: 'Awesome CV',     lang: 'en' },
  { id: 'en_03', label: 'Alta Classic',   lang: 'en' },
  { id: 'en_04', label: 'Modern One Page', lang: 'en' },
  { id: 'ja_01', label: "Jake's Clean 日本語", lang: 'ja' },
  { id: 'ja_02', label: '正式履歴書 + PR', lang: 'ja' },
  { id: 'ja_03', label: 'Tech職務経歴書', lang: 'ja' },
];
