# iOS knowledge base — router

You are working on the **iOS app** (`ios/`). Read this first, then the file for
your task. The web app (`editor/`) is another team's surface — never edit it or
`agent/web/`; cross-client needs go through `contracts/` (see
`contracts/README.md` for the change protocol).

| Task | Read |
|---|---|
| Understand the app's structure, layers, data flow | [architecture.md](architecture.md) |
| Build, sign, install to device/simulator, debug flags | [setup.md](setup.md) |
| What changed recently / current state | [state.md](state.md) |
| Why something is the way it is | [decisions.md](decisions.md) (ADR-I-###) |
| Server endpoints, tracker/Gmail shapes, Firestore paths | `contracts/` (api, tracker-record, gmail-action, normalization, firestore) |

Rules:
- After changes: update [state.md](state.md); append an ADR-I to
  [decisions.md](decisions.md) for notable decisions.
- Changing anything the web also depends on → `contracts/CHANGELOG.md` in the
  same commit.
- Branch: work on `ios`; integrate through `main`; pull `main` regularly and
  read `contracts/CHANGELOG.md` on every merge.
