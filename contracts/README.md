# contracts/ — the shared surface between the web app and the iOS app

Two teams work in this repo on two products that share one backend and one user
data store:

| Surface | Tree | Branch | Knowledge base |
|---|---|---|---|
| Web app + server | `editor/`, `Dockerfile`, `docs/`, `en/`, `ja/` | `web` | `agent/web/agent.md` |
| iOS app | `ios/` | `ios` | `agent/ios/agent.md` |
| Shared contracts | `contracts/` | both (rarely) | this folder |

Everything in this folder is a **contract**: a shape, route, algorithm, or path
that BOTH clients depend on. Breaking one breaks the other team's product
without failing your own build — which is why these files exist.

## The files

- [api.md](api.md) — the server endpoints iOS calls, and who owns each.
- [tracker-record.md](tracker-record.md) — the full TrackerRecord field union.
- [gmail-action.md](gmail-action.md) — the Gmail queue: action shape, ack, dedupe.
- [normalization.md](normalization.md) — company keys, status ranks, stamping rules.
- [firestore.md](firestore.md) — Firestore paths, profile ids, rules ownership.
- [decisions.md](decisions.md) — cross-client ADRs (ADR-S-###).
- [CHANGELOG.md](CHANGELOG.md) — every contract change, newest first.

## How to change a contract

1. Make the change on **your** branch (code + the contract file in the same
   commit).
2. Append a line to `CHANGELOG.md`: date, what changed, which side must react.
3. The other side reads `CHANGELOG.md` on every merge from `main` and applies
   their half before shipping.

Never change server routes under `/api/tracker`, `/api/internships`, or
`/api/integrations/gmail/*`, the TrackerRecord/Gmail-action shapes, Firestore
paths/rules, or the normalization algorithms without step 2. A contract change
that skips the changelog is the one kind of commit the other team cannot see
coming.

## The one data rule

**Firestore `users/{uid}/**` is the only user-data store.** The server holds
the shared catalog and the Gmail queue — never user data. Neither client may
introduce a second user-data store, and every client must **round-trip fields
it does not model** (see tracker-record.md) so one client's save can never
erase the other's work.
