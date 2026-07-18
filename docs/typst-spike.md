# W4 spike — Typst as a Tectonic replacement (2026-07-19)

Measured, not assessed. Reproduce with `typst` 0.15.1 and `tectonic` 0.16.9.

## Result: it works, but the case is weaker than the plan claimed

| | Tectonic (current) | Typst |
|---|---|---|
| EN résumé, warm cache | **1.90 s** | **0.52 s** |
| CJK document | — | **0.23 s** |
| Toolchain in the image | binary + Noto CJK fonts + glibc ≥ 2.38 | single binary |
| Templates to port | 0 (already written) | **8** (5 EN + 3 JA) + `templates.js` (993 lines) |

A Typst port of `en/01_jakes_clean.tex` compiles cleanly and renders a
structurally faithful résumé (rule-under-heading sections, role/date rows,
italic subline, tight bullets). CJK renders correctly with Hiragino Mincho, so
the 履歴書/職務経歴書 templates are feasible in principle.

## The correction

`PLAN-SIMPLIFICATION.md` originally claimed Typst is "10–100× faster." **On this
workload it is ~3.6×** (1.90 s → 0.52 s). The larger figures come from
benchmarks on long, heavily-cross-referenced documents; a one-page résumé is not
that. More importantly, the content-hash compile cache already returns most
requests in ~3 ms without invoking any engine at all, so the user-visible gain
applies only to the first compile of each distinct edit.

## Recommendation: do not switch now

The honest cost/benefit:

- **Gain:** ~1.4 s off an uncached compile; a smaller Docker image (no Tectonic
  download, no Noto CJK requirement, no glibc floor).
- **Cost:** rewriting 8 templates in a different language, re-verifying every one
  against its current PDF (including two CJK layouts where the 履歴書 grid is
  intricate table work), and rewriting the `templates.js` generator.
- **Risk:** these produce the owner's real résumés. A subtle regression in
  spacing, font fallback, or CJK line breaking is a bad résumé sent to a real
  employer.

Revisit if compile latency becomes a real complaint, or if the Tectonic
toolchain becomes a maintenance problem (a glibc bump, a broken font package).
Until then Tectonic is working, cached, and verified.

## Reference port

```typst
#set page(paper: "us-letter", margin: (x: 0.5in, y: 0.5in))
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: false)

#let section(title) = {
  v(6pt); text(size: 13pt, smallcaps(title))
  v(-6pt); line(length: 100%, stroke: 0.5pt); v(-2pt)
}
#let role(title, dates, org, place) = {
  grid(columns: (1fr, auto), align: (left, right),
    text(weight: "bold", title), text(dates))
  v(-4pt)
  grid(columns: (1fr, auto), align: (left, right),
    text(style: "italic", org), text(style: "italic", place))
  v(-2pt)
}
```

CJK check:

```typst
#set text(font: "Hiragino Mincho ProN", size: 11pt, lang: "ja")
= 職務経歴書
#table(columns: (auto, 1fr), [期間], [業務内容], [2026年6月〜], [開発])
```
