---
name: pr
description: >
  Draft a pull request title and body in this repo's style — mirrors the commit
  convention, includes a reproducible "Verified by" section, and carries no AI
  attribution. Use when opening or editing a PR with gh.
allowed-tools: Bash, Read
---

# Pull request

Commits on this branch:
!`git log main..HEAD --oneline`

Diff vs main:
!`git diff main...HEAD --stat`

---

## Title

Same grammar as a commit subject — `type(scope): imperative summary`, under 72
characters. The code doctor prefixes its PRs `[web]`, `[server]` or `[repo]`
instead; match whichever convention the target already uses.

## Body

```markdown
## What
One paragraph. What the change does, in plain language.

## Why
The problem it solves, and what was wrong before. Name the concrete failure —
the reader is deciding whether to trust this, and a specific broken behaviour
is more convincing than an adjective.

## Verified by
Exact commands and their outcomes, so the reviewer can reproduce them:

    scripts/verify-web.sh   → build ✓ · catalog ✓ · playwright 5/5 · react-doctor 46
```

`## Verified by` is the section that matters most across accounts: it is how the
doctor and later sessions confirm a claim without re-deriving it. Vague entries
("tested locally") make the whole PR unverifiable.

## Never

No `Generated with Claude Code`, no `Co-Authored-By: Claude`, no 🤖. The guard
hook blocks `gh pr create` and `gh pr edit` containing them.
