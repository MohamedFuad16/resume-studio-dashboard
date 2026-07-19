# contracts/CHANGELOG.md entry

Newest first. This file is what the other surface actually reads on merge, so
the action item must be explicit — not implied.

```markdown
- **YYYY-MM-DD · web|iOS|repo · Title of the change.** What changed and why, in
  a couple of sentences. **Other side: <exactly what they must do, or "nothing
  to do" and why>.**
```

Rules:

- Required in the SAME commit as the contract change (CLAUDE.md rule 2). A
  `PostToolUse` hook reminds you when you edit anything under `contracts/`.
- "Nothing to do" is a valid and useful entry — it tells the other surface they
  can skip it, instead of leaving them to work that out.
- A request to the other surface goes here, never as an edit to their tree
  (rule 1).
