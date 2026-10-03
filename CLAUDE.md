# CLAUDE.md

One product in this repo since 2026-10-03: the Internship Portal web app and
its API. The iOS app, the shared `contracts/` layer and the LaTeX résumés moved
to `~/Documents/InternshipPortal-archive` and come back only when the owner
says so.

- **Code:** `editor/` (React client in `src/`, Express API in `server/`),
  `Dockerfile`, `scripts/`
- **Knowledge base:** [`agent/agent.md`](agent/agent.md)
- **Rebuild:** [`docs/rebuild-plan.md`](docs/rebuild-plan.md) holds the target
  architecture, the owner's decisions and the phase list.

ALWAYS read `agent/agent.md` first and follow its routing table, then find the
first open phase in the rebuild plan.

## Rules

1. **One branch.** `main` is the only long-lived branch. Use a short-lived
   branch when a change needs review, and merge it after `/preflight`.
2. **User data.** The rebuild moves user data from Firestore to the EC2
   database (plan phase 2). Until that lands, every write must round-trip the
   record fields it does not model.
3. **Spending.** Any run that spends OpenRouter credits needs the owner's yes
   first, with an estimate. Spend caps change only by the owner's hand.
4. **After changes:** update `agent/state.md` with a dated entry and append
   ADRs to `agent/decisions.md` (`ADR-####`). Never commit secrets;
   `agent/secrets.md` is pointers only.
5. **Doctor PRs.** A third account audits the repo and files findings as
   `doctor/*` PRs (see `DOCTOR.md`). At session start, check open doctor PRs:
   reproduce with the PR's "Verified by" command; if real, fix it on your
   branch and close the PR with a comment; if not, close it with the reason.
   Never merge a doctor PR directly.
6. **Toolkit.** Commit with the `/commit` skill: Conventional, scoped, and
   never carrying AI attribution (no `Co-Authored-By: Claude`, no "Generated
   with", no robot emoji). A `PreToolUse` hook blocks commits and PRs that do.
   Before merging to `main`, run `/preflight` (`scripts/verify-web.sh`), then
   the `code-reviewer` agent on the diff. After substantive changes, the
   `scribe` agent updates the state file and ADRs. Rote multi-file sweeps go to
   `mech`.
7. **This repo is public.** Keep secrets, unfixed vulnerability details and
   private decisions out of commits, issues and PR bodies.
