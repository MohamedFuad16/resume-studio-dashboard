---
name: preflight
description: >
  The pre-merge verification ritual. Use PROACTIVELY before merging editor/
  work into main, and whenever the user says preflight. Runs the battery and
  blocks the merge on failure.
allowed-tools: Bash, Read
---

# Preflight

Files changed vs main:
!`git diff main...HEAD --name-only`

Uncommitted:
!`git status --short`

---

This gate is the repo's answer to issue #18: a local ritual instead of CI for
the full battery. Treat a skip as shipping unverified code.

## Battery

Run `scripts/verify-web.sh`. When the output will be long, delegate to the
`verifier` agent instead so this context stays clean.

## Gate

**Do not merge** if any step reports FAIL, or if the react-doctor score has fallen
below the baseline in `scripts/verify-web.sh`. Report what failed and stop —
do not fix it inside preflight, and do not merge "just this once" because the
failure looks unrelated. If the failure genuinely is environmental (port 5173
held by a dev server is the common one), say so, clear it, and re-run.

## On pass

Print a block ready to paste into the commit body or PR:

```
Verified by:
  scripts/verify-web.sh   → build ✓ · catalog ✓ · playwright 5/5 · react-doctor NN
```

Then hand back — the caller merges.
