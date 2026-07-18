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
