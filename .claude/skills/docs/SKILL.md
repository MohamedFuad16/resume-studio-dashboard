---
name: docs
description: >
  This repo's documentation formats — state.md dated entries, ADR skeletons for
  all three numbering spaces, and contracts/CHANGELOG.md entries. Use when
  updating those files by hand, instead of delegating to the scribe agent.
allowed-tools: Read, Grep, Edit
---

# Documentation formats

The `scribe` agent loads this skill; use it directly for a one-line doc tweak
that does not justify spawning an agent.

## Routing

| Change touches | File | Numbering |
|---|---|---|
| `editor/` | `agent/web/state.md`, `agent/web/decisions.md` | `ADR-####` |
| `ios/` | `agent/ios/state.md`, `agent/ios/decisions.md` | `ADR-I-###` |
| Both clients | `contracts/CHANGELOG.md`, `contracts/decisions.md` | `ADR-S-###` |
| Architecture a newcomer would misread | `README.md` | — |

The three ADR spaces are disjoint on purpose: the two teams once appended two
ADR-0044s and two ADR-0045s to a shared file on the same day. Always read the
tail of the target file and increment; never reuse.

## Formats

- Dated state entry → [references/state-entry.md](references/state-entry.md)
- ADR → [references/adr.md](references/adr.md)
- Contract changelog entry → [references/changelog-entry.md](references/changelog-entry.md)

## The rule that matters more than the format

Match the file you are editing. Read its two or three most recent entries first
and imitate their voice and density. The house style states what changed, then
**why the previous behaviour was wrong**, and names the failure it prevents. An
entry that only says what changed is not worth the line it occupies — the diff
already said that.

Write only what was actually done and observed. If a battery was not run, do not
write that it passed.
