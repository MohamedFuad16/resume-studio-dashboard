# ADR skeletons

Three disjoint numbering spaces. Read the tail of the target file and increment;
never reuse a number.

| File | Prefix | Scope |
|---|---|---|
| `agent/web/decisions.md` | `ADR-####` | web only |
| `agent/ios/decisions.md` | `ADR-I-###` | iOS only |
| `contracts/decisions.md` | `ADR-S-###` | binds BOTH surfaces |

Recent house style (prose, no rigid headers):

```markdown
## ADR-0040 · 2026-07-19 · Short decision, stated as a fact

<What changed, in one paragraph.>

<What was tried first and why it failed — the failed attempt is usually the most
valuable part of the record, because it is what stops the next person repeating
it. Be concrete about the failure mode.>

Decision: <the rule that now holds, phrased so someone can apply it.>

<How it was verified — the checks that would have caught the earlier failure.>
```

Choose `ADR-S-###` whenever the other surface is bound by the decision. A
per-surface ADR wrongly implies the other team may ignore it.
