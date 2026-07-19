---
name: commit
description: >
  Draft and make a commit in this repo's style — Conventional, surface-scoped,
  written in a human voice, with no AI attribution. Use whenever committing.
allowed-tools: Bash, Read
---

# Commit

Branch: !`git branch --show-current`

Staged:
!`git diff --staged --stat`

Unstaged / untracked:
!`git status --short`

Full staged diff:
!`git diff --staged`

---

If nothing is staged, look at the unstaged changes above, say what you propose to
stage, and stage it — do not commit a partial change silently.

## Format

```
type(scope): imperative subject under 72 chars

Body explaining WHY, wrapped at 72. The diff already shows what changed;
the body exists for the reader who wants to know what problem this solves
and what was wrong before.
```

**Types:** `feat` `fix` `docs` `refactor` `perf` `test` `chore` `build`
**Scopes:** `ios` `web` `contracts` `server` `repo` (repo = cross-cutting, e.g. tooling)

Pick the scope from the tree that dominates the diff. A commit that changes code
*and* its `contracts/CHANGELOG.md` entry keeps the code's scope — rule 2 wants
them in one commit, so that is normal, not a mixed commit.

## Voice

Write like an engineer explaining the change to a teammate who will read it in
six months:

- Imperative mood, no trailing period on the subject: "broaden the purge
  predicate", not "Broadened…" or "This broadens…".
- The body earns its place by explaining cause. "Legacy rows predate source
  stamping, so the old predicate skipped them" is worth writing; "updated the
  filter" is not.
- Name the concrete failure when there was one. Past commits in this repo read
  like: *"Reads worked in prod but every WRITE failed SQLITE_BUSY — SQLite
  file-locking is unsupported on the Azure Files SMB share."* Match that.
- No emoji. No bullet-list bodies unless the change genuinely has several
  independent parts.
- Reference a doctor PR or issue number when the commit answers one (`#19`).

## Never

- `Co-Authored-By: Claude …`
- `Generated with Claude Code` / any tool footer
- 🤖 or any other attribution marker

A `PreToolUse` hook blocks commits containing these, so a message with attribution
will simply fail. Write it clean the first time.

## Procedure

Draft the message, show it, then commit with one `-m` for the subject and one for
the body. Keep the message inline — the guard hook only inspects inline `-m`
text, so committing via a file would bypass the very check that keeps the history
uniform.
