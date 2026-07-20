// Stable keys for READ-ONLY display lists whose items are plain strings
// (catalog eligibility bullets, process steps, legal paragraphs …).
// Key = the content itself, with an occurrence counter so duplicate strings
// stay unique — independent of the item's absolute position, so a re-render
// with an inserted item does not re-key everything after it the way array
// indexes do. NOT for editable/reorderable lists — those need persisted ids.
export function keyed(values) {
  const seen = new Map();
  return (values || []).map(value => {
    const text = String(value);
    const n = seen.get(text) || 0;
    seen.set(text, n + 1);
    return { value, key: n ? `${text}#${n}` : text };
  });
}
