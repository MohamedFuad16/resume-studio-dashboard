# Shared decisions (ADR-S) — cross-client, both teams bound

Full historical text of pre-split shared ADRs lives in `agent/web/decisions.md`
(they were made web-side first). This file is the authoritative index of the
decisions BOTH clients depend on, plus new shared decisions going forward.

## Inherited (pointers)

- **ADR-0014/0015 — Firebase Auth gate + client-direct Firestore migration.**
  User data lives in `users/{uid}/**`, written by clients directly under
  owner-only rules; the server never sees it. → contracts/firestore.md
- **ADR-0016 — Per-user AI settings in Firestore** (`users/{uid}/settings/app`);
  the OpenRouter key travels per-request, never stored server-side.
- **ADR-0019 — Compile/research backend on Azure Container Apps** (always-on,
  min=max=1 replica; in-memory job state pins everything to one replica).
- **ADR-0032 — Durable server storage on Azure Files** (sql.js KV snapshot; the
  Gmail queue + catalog survive restarts).
- **ADR-0034 — Self-healing catalog via a machine-owned JSON overlay.**
- **ADR-0035 — Gmail ingest: server-side read-only OAuth + client-drained
  queue.** The server classifies and queues; clients apply to their own
  Firestore tracker. → contracts/gmail-action.md

## New

## ADR-S-001 · 2026-07-18 · Two-branch split with a contracts layer

Two teams (web on one device, iOS on another) collided in one knowledge base:
duplicate ADR numbers (two ADR-0044s, two ADR-0045s), contradictory state
entries, and silently drifting duplicated logic (company-key normalization).
Decision: `web` and `ios` branches integrate through `main`; `agent/` splits
into `agent/web/` + `agent/ios/` (disjoint ADR number spaces: `ADR-####` web,
`ADR-I-###` iOS); everything both clients depend on is written down in
`contracts/` and changed only via `contracts/CHANGELOG.md`. User data stays
central by rule: Firestore is the only user-data store, and every client must
round-trip fields it does not model (the iOS `extra` passthrough exists because
iOS saves used to erase web-written fields — the exact failure this structure
prevents).

## ADR-S-002 · 2026-07-18 · Internship detection is server-side and evidence-based

Owner directive: no hardcoded company lists anywhere. The classifier
(`editor/server/gmail/classify.js`) must QUOTE the email's own words as
evidence; the quote is verified (punctuation-folded) against the email.
Deployed and verified against the real inbox 2026-07-18: an 80-message backfill
correctly dropped 23 non-internships (gig/support mail) and queued 20 real
internships with real dates. Client-side company-name filters are to be retired
(web's micro1/gig filters included) — junk in the queue means fixing
classify.js, not filtering names downstream.

## ADR-S-003 · 2026-07-20 · The agentic toolkit is checked in, and it binds both surfaces

Two devices, two Claude Code sessions, one repo — and until now nothing about
how those sessions work was written down. Each session invented its own commit
style, its own idea of "verified", and its own moment to update the docs. The
symptoms were visible in the history: AI attribution trailers the owner had to
strip by hand, and issue #18 — a Swift change reaching `main` that nobody had
ever compiled, because "build it first" lived only in whoever's head was
driving that day.

Decision: `.claude/` is repo state, not machine state. Committed and shared:
four subagents (`code-reviewer` on opus for unbiased pre-merge review,
`verifier` on haiku for the battery, `scribe` on sonnet for doc upkeep, `mech`
on haiku for rote sweeps), four skills (`commit`, `pr`, `preflight`, `docs`),
and four hooks. Model choice is deliberate rather than uniform: review is the
one job where a fresh, expensive, unpersuadable reader earns its cost, and
running the battery is the one job where a cheap model reading exit codes is
just as correct.

Two pieces are load-bearing rather than convenience:

- **`scripts/verify-{web,ios}.sh` is a single source of truth**, invoked by the
  `preflight` skill, the `verifier` agent, and the code doctor alike. When those
  three ran different commands, "green on my machine" and "the doctor filed a
  bug" were both true at once.
- **`guard-commit.sh` blocks AI attribution at the tool call** (`exit 2`, so the
  refusal is fed back to the model and it retries). A rule stated in CLAUDE.md is
  advice; a rule that fails the command is a rule. The guard fails *safe* — if it
  cannot parse the hook payload it scans the raw text rather than allowing the
  commit through, because a guard that silently permits everything the moment its
  parser trips is worse than no guard at all.

Two deliberate non-decisions: no push-to-`main` guard (merging into `main` IS
the workflow under rule 3), and no session-start doctor-PR check (a network
round-trip on every session start to enforce something rule 6 already says).

Consequence for both teams: pull, then restart the session — **hook
configuration is read once at session start**, so a session that predates the
pull is running without the guard. Anything personal (the iMessage handle for
`notify.sh`) belongs in the uncommitted `.claude/settings.local.json`; with the
variable unset the notifier is a silent no-op, which is what the second device
should see. → CLAUDE.md rule 7, DOCTOR.md

## ADR-S-004 · 2026-07-20 · The tracker records user truth, not just classifier output

Every data complaint this project has had traces to one property: **the tracker
was a cache of classifier output.** The owner deleted a role they had never
applied to and the next rescan re-created it. They knew they had been rejected by
five companies and the records read "applied" until the classifier was repaired
and re-run. Nothing they did in the app survived a re-derive, so their only
correction channel was telling a developer in chat.

Five fixes shipped against the symptoms — purge predicate, per-role keying,
Japanese rejection register, bulk-mail handling, tracked-company carry-forward.
Each was individually correct. None of them closed the complaint, because none of
them addressed the missing channel. And no sixth one will: the classifier will
never be perfect, and the owner always knows more than the mail says. Money
Forward is the clean example — the interview and the rejection are the same
application described with two different role strings, so per-role keying splits
them and the stale interview survives. Every rule that merges those two also
re-merges Rakuten's genuinely distinct TECH Camp applications, which is the bug
per-role keying was introduced to fix. There is no role-string heuristic that
separates them, and picking one just moves who discovers the error.

Decision: the owner can overrule the pipeline, permanently.

- **`statusPinned`** — a status set by hand is never touched by a drain again.
  The drain may still enrich detail fields; it may not move the status, the
  stamps or the milestones. A pinned record is treated as hand-added by the
  rebuild purge whatever its `source` says, because a purge that deletes a status
  the owner typed is ADR-I-015 in a different hat.
- **Tombstones** — a deleted `(companyKey, roleKey)` is recorded per profile and
  never re-created by a drain. Re-applying lifts it: an `applied` action with
  evidence newer than the tombstone removes it, so deletion is permanent against
  re-derives without making a company permanently un-trackable.

The cost is honest and worth naming: the tracker can now disagree with the mail,
and a pin can go stale if the owner pins a status and the situation later changes.
That is the correct trade. A wrong record the owner can fix in one tap beats a
right-in-principle record they must ask a developer to repair — and it converts an
open-ended series of classifier guesses into a bounded, one-time correction.

→ contracts/tracker-record.md "User truth outranks the pipeline"
