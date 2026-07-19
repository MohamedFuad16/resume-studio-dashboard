# state.md entry

Newest first, immediately under `## Recent changes`. Bold dated lead, then dense
causal prose. Reference ADRs by number.

```markdown
- **YYYY-MM-DD — Short title of what changed (ADR-####).** What is now true, in
  one or two sentences. Then WHY the previous behaviour was wrong and what
  failure this prevents — that is the part worth writing, because the diff
  already shows the change. Name what was verified and how ("build green,
  Playwright 5/5, sync-now HTTP 200"), and only if it was actually run.
```

Supersede rather than delete when an older entry became false:

```markdown
- **YYYY-MM-DD — X shipped on the second attempt (ADR-####).** SUPERSEDES the
  "attempted, REVERTED" entry below — the rollback was real, but the conclusion
  was too broad. <what actually holds now>
```

Update the `## Current state summary` block only when the change materially
alters it.
