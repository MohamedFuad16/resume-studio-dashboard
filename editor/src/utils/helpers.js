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
// the server round-trips unknown per-item fields.
export const newItemId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
