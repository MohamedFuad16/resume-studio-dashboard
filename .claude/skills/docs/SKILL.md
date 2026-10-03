---
name: docs
description: >
  This repo's documentation formats: agent/state.md dated entries and ADR
  skeletons for agent/decisions.md. Use when updating those files by hand,
  instead of delegating to the scribe agent.
allowed-tools: Read, Grep, Edit
---

# Documentation formats

The `scribe` agent loads this skill; use it directly for a one-line doc tweak
that does not justify spawning an agent.

## Routing

| Change touches | File | Numbering |
|---|---|---|
| `editor/`, `Dockerfile`, `scripts/` | `agent/state.md`, `agent/decisions.md` | `ADR-####` |
| A rebuild phase finished or changed | `docs/rebuild-plan.md` | none |
| Architecture a newcomer would misread | `README.md` | none |

Always read the tail of `agent/decisions.md` and increment; never reuse a
number. The iOS (`ADR-I-###`) and shared (`ADR-S-###`) spaces were retired with
the iOS app on 2026-10-03; their files live in `~/Documents/InternshipPortal-archive`.

## Formats

- Dated state entry → [references/state-entry.md](references/state-entry.md)
- ADR → [references/adr.md](references/adr.md)

## The rule that matters more than the format

Match the file you are editing. Read its two or three most recent entries first
and imitate their voice and density. The house style states what changed, then
**why the previous behaviour was wrong**, and names the failure it prevents. An
entry that only says what changed is not worth the line it occupies — the diff
already said that.

Write only what was actually done and observed. If a battery was not run, do not
write that it passed.
