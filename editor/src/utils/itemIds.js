// Stable per-item identity for the reorderable résumé lists.
//
// Education / experience / projects / activities rows can be moved up, moved down
// and deleted. Keying those lists by array index ties React component state and
// uncontrolled DOM state (focus, caret position, autosized textarea height) to the
// *slot* instead of the *item*, so reordering leaves that state behind on the old
// position. Keying by object identity is not an option either: every keystroke maps
// the row to a fresh object, which would remount it mid-typing.
//
// So each row carries a persisted `id`. It is minted at every creation site and
// backfilled on load by `ensureItemIds` (see normalizeResume in App.jsx). The field
// round-trips untouched through the server: `validateResume` only checks array-ness
// and length, and the LaTeX templates read named fields only.

/**
 * Mint a new item id. Prefers crypto.randomUUID, which needs a secure context —
 * falls back to a time+random string when the page is served over plain http.
 */
export function newItemId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`
  );
}

/** Return `item` with an `id`, minting one only when it is missing. */
export function withItemId(item) {
  const base = item && typeof item === 'object' ? item : {};
  return base.id ? base : { ...base, id: newItemId() };
}

/** Backfill ids across one list, leaving existing ids alone. */
export function ensureListIds(list) {
  return Array.isArray(list) ? list.map(withItemId) : [];
}
