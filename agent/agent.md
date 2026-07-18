# Agent knowledge base — router

This repo has TWO products built by TWO teams, plus a shared contract layer.
Route by what you're working on:

| Working on | Tree | Go to |
|---|---|---|
| **iOS app** | `ios/` | [`agent/ios/agent.md`](ios/agent.md) |
| **Web app / server / LaTeX pipeline** | `editor/`, `Dockerfile`, `docs/`, `en/`, `ja/` | [`agent/web/agent.md`](web/agent.md) |
| **Anything both clients depend on** (API routes, tracker/Gmail shapes, Firestore, normalization) | `contracts/` | [`contracts/README.md`](../contracts/README.md) |

Hard rules (both teams):
1. Never edit the other surface's tree or agent folder.
2. Contract changes require a `contracts/CHANGELOG.md` entry in the same commit.
3. Branches: web on `web`, iOS on `ios`, integrate through `main`.
4. Firestore `users/{uid}/**` is the only user-data store; clients must
   round-trip fields they don't model.

History note: before 2026-07-18 this folder was a single shared knowledge base;
the split (and why) is ADR-S-001 in `contracts/decisions.md`.
