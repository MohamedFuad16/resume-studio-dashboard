---
name: preflight
description: >
  The pre-merge verification ritual. Use PROACTIVELY before merging ios/ or
  editor/ work into main, and whenever the user says preflight. Detects which
  surfaces the diff touches, runs their batteries, and blocks the merge on
  failure.
allowed-tools: Bash, Read
---

# Preflight

Files changed vs main:
!`git diff main...HEAD --name-only`

Uncommitted:
!`git status --short`

---

This gate is the repo's answer to issue #18. There is deliberately **no macOS CI
runner**: the owner chose a local ritual instead, so nothing verifies iOS unless
this runs. Treat a skip as shipping unverified Swift.

## Which batteries

| Changed paths | Run |
|---|---|
| `editor/**` | `scripts/verify-web.sh` |
| `ios/**` | `scripts/verify-ios.sh` |
| `contracts/**` | **both** — a contract change must prove neither client broke |

Run them inline when one surface is involved. When both are, or when the output
will be long, delegate to the `verifier` agent instead so this context stays
clean.

## Gate

**Do not merge** if any step reports FAIL, or if the react-doctor score has fallen
below the baseline in `scripts/verify-web.sh`. Report what failed and stop —
do not fix it inside preflight, and do not merge "just this once" because the
failure looks unrelated. If the failure genuinely is environmental (port 5173
held by a dev server is the common one), say so, clear it, and re-run.

Missing optional tools are not failures: `verify-ios.sh` reports
`SKIP swiftlint` when it is not installed, and that is a pass.

## On pass

Print a block ready to paste into the commit body or PR:

```
Verified by:
  scripts/verify-ios.sh   → 0 errors, N warnings, swiftlint clean
  scripts/verify-web.sh   → build ✓ · catalog ✓ · playwright 5/5 · react-doctor NN
```

Then hand back — the caller merges.
