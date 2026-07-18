# Architecture simplification — verified assessment + phased plan

Owner-requested review of the stack (2026-07-19). Each claim below is marked
verified or assessed; each phase has a single owning team. Work lands via the
normal branch flow; contract-touching steps go through `contracts/CHANGELOG.md`.

## Verdicts

| Layer | Today | Verdict |
|---|---|---|
| React 18 + Vite | web client | ✅ **Keep.** Standard, fast, no problem to solve. |
| GSAP animations | dashboard charts | ✅ Keep. |
| `index.css` (~8,300 lines) | all styling, Tailwind installed but **dead config** (zero `@tailwind` directives — verified by the web team's own sweep) | 🔧 **Migrate to Tailwind, incrementally.** One monolithic CSS file is unmanageable and the utility framework is already a dependency. Component-by-component with screenshot parity — never a big-bang rewrite. |
| Node/Express server | catalog, compile, research, Gmail | ✅ Keep. |
| **Vercel serverless Express** (`editor/api/[...path].js`) + **Vercel Blob** | duplicate home for the same server | ❌ **Delete.** Since `VITE_API_BASE_URL` bakes the full Azure URL into the bundle (verified live), every `/api/*` call already goes to Azure. The Vercel function serves nothing; Blob (exhausted quota) exists only as its storage. Vercel becomes what it's good at: **static hosting for the SPA, nothing else.** |
| **sql.js (WASM SQLite) + snapshot persistence** | server KV on the Azure Files mount | 🔧 **Replace with native SQLite (`better-sqlite3`) on the same mount.** The WASM engine + whole-DB snapshot dance is the real jank, not SQLite itself. The server is deliberately single-replica (in-memory research jobs), so a single-writer file DB is the *right size* — this is a ~1-day change, zero new infra, zero new cost. |
| — Postgres instead? | owner suggestion | ⚖️ **Valid, but not yet.** Managed Postgres (Azure Flexible Server) adds ~$13–30/mo + connection/firewall plumbing, and buys concurrency the single-replica design can't use. The moment we want multiple replicas or relational queries across users, Postgres is the move — and the storage layer (`storage.js`) is already a thin KV interface, so swapping later is contained. Decision: native SQLite now, Postgres as a planned Phase-2 if/when replicas matter. |
| **Firebase Auth + Firestore** | identity + all user data | ✅ **Keep — this is the piece that looks redundant but isn't.** See below. |
| Tectonic (LaTeX) | PDF engine | 🔧 **Typst is the better engine** — 10–100× faster compiles, one small binary (no font/glibc gymnastics), first-class CJK. But it means rewriting the EN/JA templates. Do it as a parity-gated spike: keep Tectonic until a Typst template matches the current PDFs pixel-for-purpose. Optional phase; the compile cache already hides most of Tectonic's cost. |
| iOS app | SwiftUI native | ✅ Keep as-is (owner's call). |

## Why Firebase stays (the auth/data confusion, answered)

- **Firebase Auth** stores *identity*: email+password credentials, the Google
  sign-in link, and issues the `uid` + ID tokens. No app data lives there.
- **Firestore** stores *user data* keyed by that uid (`users/{uid}/…`), and its
  **security rules let each client talk to the database directly** — the server
  never sees user data and has no user-data API to build, secure, or scale.
- Moving user data to Azure/Postgres would mean: building a full authenticated
  CRUD API on the Express server (token verification, per-user authorization,
  rate limiting), migrating BOTH clients off the Firestore SDKs, and losing
  offline caching — weeks of high-risk work for zero user-visible gain, on the
  layer where a bug means data loss or leakage.
- The result is a clean two-store split, one purpose each: **Firestore = user
  data (client-direct) · Azure SQLite = shared data (catalog + Gmail queue)**.
  That's not "multiple layers" — it's the minimum two.

## Phases & ownership

| # | What | Owner | Size | Notes |
|---|---|---|---|---|
| W1 | Delete `editor/api/[...path].js`, `vercel.json` function config, `@vercel/blob` dep + Blob code paths in `storage.js` | web | S | Verify nothing else reads Blob first. Vercel = static only. |
| W2 | `storage.js`: sql.js → `better-sqlite3` on the Azure Files mount (same file, one-time schema import) | web | M | Back up `resume-studio.sqlite` before first deploy. contracts/ unaffected (KV interface unchanged). |
| W3 | Tailwind migration of `index.css`, component-by-component with visual parity checks | web | L (ongoing) | Delete migrated CSS sections as you go; track % in agent/web/state.md. |
| W4 | Typst spike: EN + JA resume template at parity, then swap `templates.js` + Dockerfile | web | L (optional) | Keep Tectonic until parity is proven side-by-side. |
| W5 | Enrichment for known-but-sparse companies (see contracts/CHANGELOG 2026-07-19 request) | web | S | The LAPRAS case: Gmail row exists but has no URL/location/details. |
| I1 | Background app refresh + auto-notifications | iOS | — | ✅ Done 2026-07-19. |
| I2 | Surface enrichment + reapply fields in the record sheet UI | iOS | S | Data already round-trips; show it. |
| I3 | Remove debug scaffolding (splash-every-launch, review tags) at ship time | iOS | S | Listed in agent/ios/setup.md. |
| D1 | Code-doctor account setup | owner + doctor | — | See DOCTOR.md. |

**Sequencing:** W1 → W2 land first (small, kill the most confusion), W3 runs
continuously behind features, W4 whenever there's slack. Nothing here blocks
feature work on either surface.
