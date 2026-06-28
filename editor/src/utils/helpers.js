// Debounce helper
export function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Deep clone
export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export const TEMPLATES = [
  { id: 'en_01', label: "Jake's Clean",   lang: 'en' },
  { id: 'en_02', label: 'Awesome CV',     lang: 'en' },
  { id: 'en_03', label: 'Alta Classic',   lang: 'en' },
  { id: 'en_04', label: 'Modern One Page', lang: 'en' },
  { id: 'ja_01', label: '学校指定 履歴書', lang: 'ja' },
  { id: 'ja_02', label: '正式履歴書 + PR', lang: 'ja' },
  { id: 'ja_03', label: 'Tech職務経歴書', lang: 'ja' },
];
