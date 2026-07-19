# CLAUDE.md

One repo, two products, two teams, one contract layer:

- **iOS app** — `ios/` · branch `ios` · knowledge base [`agent/ios/agent.md`](agent/ios/agent.md)
- **Web app + server** — `editor/`, `Dockerfile`, `docs/`, `en/`, `ja/` · branch `web` · knowledge base [`agent/web/agent.md`](agent/web/agent.md)
- **Shared contracts** — [`contracts/`](contracts/README.md): the API routes, data
  shapes, Firestore paths, and normalization algorithms BOTH clients depend on.

ALWAYS read your surface's `agent.md` first and follow its routing table.

## Rules

1. **Stay on your surface.** Never edit the other team's tree or agent folder.
   If a task needs a change there, write it as a request in
   `contracts/CHANGELOG.md` and stop.
2. **Contracts are load-bearing.** Before changing server routes
   (`/api/tracker`, `/api/internships`, `/api/integrations/gmail/*`),
   TrackerRecord or Gmail-action fields, Firestore paths/rules, or the
   company-key / status-rank algorithms — read the matching `contracts/` file
   and add a `contracts/CHANGELOG.md` entry in the same commit.
3. **Branches.** Web works on `web`, iOS on `ios`; integrate through `main`.
   Merge `main` into your branch regularly and read `contracts/CHANGELOG.md`
   on every merge.
4. **User data is central.** Firestore `users/{uid}/**` is the only user-data
   store; the server holds only the shared catalog + Gmail queue. Every client
   must round-trip record fields it does not model.
5. **After changes:** update YOUR `state.md`; append ADRs to YOUR
   `decisions.md` (iOS: `ADR-I-###` · web: `ADR-####` · shared:
   `contracts/decisions.md` `ADR-S-###`). Never commit secrets
   (`agent/web/secrets.md` is pointers-only).
6. **Doctor PRs.** A third account audits the repo and files findings as
   `doctor/*` PRs (see `DOCTOR.md`). At session start, check open doctor PRs
   for YOUR surface: reproduce with the PR's "Verified by" command; if real,
   fix on your branch and close the PR with a comment; if not, close with the
   reason. Never leave one unanswered past a working day, and never merge a
   doctor PR directly — the fix belongs on your branch.
7. **Toolkit.** Commit with the `/commit` skill: Conventional, surface-scoped,
   and **never carrying AI attribution** — no `Co-Authored-By: Claude`, no
   "Generated with…", no 🤖. A `PreToolUse` hook blocks commits and PRs that do.
   Before merging to `main`, run `/preflight` (the local verification ritual —
   `scripts/verify-web.sh` / `scripts/verify-ios.sh`; there is no CI for iOS, so
   skipping it ships unverified Swift), then the `code-reviewer` agent on the
   diff. After substantive changes, the `scribe` agent updates state.md, ADRs
   and the contracts changelog. Rote multi-file sweeps go to `mech`.
