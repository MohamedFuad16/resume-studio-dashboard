# Internship Portal — how to build with this system

## No provider, no wrapper

Components render standalone. There is no ThemeProvider, no context, no root wrapper —
mount any component directly. The only requirement is that `styles.css` is loaded; every
token and component style reaches a design through its `@import` closure.

## The styling idiom: CSS custom properties + plain class names

This is **not** a utility-class system and **not** a props-based theme system. Components
carry fixed semantic class names (`.btn`, `.f`, `.fl`, `.sec`, `.toast-tray`) defined in the
shipped stylesheet, and everything themeable is a CSS custom property. Style your own layout
glue with `var(--*)` — never invent utility classes; none exist here.

The tokens you should actually use (all defined in `styles.css`'s closure):

| Purpose | Tokens |
|---|---|
| Surfaces | `--bg`, `--panel`, `--card`, `--input-bg`, `--hover` |
| Borders | `--b0` (hairline), `--b1` (stronger), `--b-focus`, `--b-focus-glow` |
| Text | `--t1` (ink), `--t2` (muted), `--t3` (faint) |
| Primary action | `--halo-bg`, `--halo-bg-hover` (flat blue `#1a56f0`) |
| Accent | `--blue`, `--blue-dim`, `--blue-glow` — the SAME blue as `--halo-bg` |
| Status | `--green`, `--amber`, `--red`, `--red-dim`, `--err` |
| Radius | `--r-btn` (10px — buttons, inputs, selects), `--r` (8px) |
| Motion | `--ease` (120ms), `--ease-s` (220ms) |

Two rules this system holds to, which a design should not break:

- **Blue means "primary action" and nothing else.** Surfaces, ink, borders and icons are
  neutral. A blue that isn't an action reads as a bug here.
- **Controls are rounded rects at `--r-btn` (10px), never pills.** Only avatars and count
  badges are fully round (`border-radius: 50%`).

## Where the truth lives

- `styles.css` and its `@import`s (chiefly `_ds_bundle.css`) — the real token definitions and
  every component's real styles. Read these before styling anything.
- `components/<Name>/<Name>.prompt.md` — per-component usage.
- **Caveat:** this repo has no TypeScript, so the generated `<Name>.d.ts` props are thin.
  Trust the preview cards and the stylesheet over the type signatures.

## Fields are controlled

Every input takes `value` + `onChange`. `Inp`, `Txta`, `TagInput`, `SuggestInput` and
`MonthInput` render empty without a value — that is not a bug, it is a controlled component.
The `*Sec` sections take `data` + `onChange` + `isJa`, where `data` is an object for
`PersonalSec`/`SummarySec` and an **array of entries** for `EducationSec`, `ExperienceSec`,
`ProjectsSec` and `ActivitiesSec`.

## Bilingual by construction

`isJa` is a real prop, not an afterthought: the `*Sec` sections relabel entirely in Japanese
(職歴, 学歴, プロジェクト, 活動・資格). Any design using these should decide which language it
is in and pass `isJa` consistently.

## Idiomatic example

```jsx
<div style={{ display: 'grid', gap: 14, maxWidth: 640 }}>
  <Inp label="Name (English)" value={name} onChange={setName} />
  <Txta label="Professional summary" value={summary} onChange={setSummary} rows={6} />
  <button
    className="btn btn-primary"
    style={{ borderRadius: 'var(--r-btn)', background: 'var(--halo-bg)', color: '#fff' }}
  >
    <I n="check" s={13} /> Save changes
  </button>
</div>
```

`I` needs an `n` from its fixed name map: `menu user edu work code zap star txt file dl ai
json sync plus x check chev radar panel brain sun moon collapse`. Any other name renders an
empty `<svg>`.
