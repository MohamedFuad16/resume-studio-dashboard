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
| Tectonic (LaTeX) | PDF engine | ⏸️ **Spiked and deferred — see `docs/typst-spike.md`.** Typst works (a ported EN résumé compiles clean; CJK renders), but MEASURED it is ~3.6× faster here (1.90 s → 0.52 s), not the 10–100× this plan first claimed — and the compile cache already answers most requests in ~3 ms without any engine. Against that: rewriting 8 templates + a 993-line generator, on the documents that produce real résumés. Not worth it now. |
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
| W1 | ✅ **DONE** — serverless catch-all + `vercel.json` functions + `@vercel/blob` deleted; Vercel is static-only | web | S | Shipped with W2 (ADR-0040). |
| W2 | ✅ **DONE (2nd attempt)** — `better-sqlite3` on a LOCAL working copy, snapshotted to the mount | web | M | First attempt opened the DB directly on the SMB mount → `SQLITE_BUSY` on every write, rolled back. The two-tier design avoids SQLite locking on the mount entirely. Verified in prod: `sqlite-snapshot`, 172 roles, `sync-now` 200, zero lock errors. ADR-0040. |
| W3 | 🟡 **FOUNDATION DONE** — Tailwind enabled (preflight OFF) with design tokens wired to the CSS variables; migration is incremental | web | L (ongoing) | See "W3 status" below. |
| W4 | ⏸️ **SPIKED, DEFERRED** — evidence in `docs/typst-spike.md` | web | L | Measured ~3.6× (not 10–100×); cost is 8 template rewrites on real résumés. Revisit only if latency becomes a complaint. |
| W5 | Enrichment for known-but-sparse companies (see contracts/CHANGELOG 2026-07-19 request) | web | S | The LAPRAS case: Gmail row exists but has no URL/location/details. |
| I1 | Background app refresh + auto-notifications | iOS | — | ✅ Done 2026-07-19. |
| I2 | Surface enrichment + reapply fields in the record sheet UI | iOS | S | Data already round-trips; show it. |
| I3 | Remove debug scaffolding (splash-every-launch, review tags) at ship time | iOS | S | Listed in agent/ios/setup.md. |
| D1 | Code-doctor account setup | owner + doctor | — | See DOCTOR.md. |

**Sequencing:** W1 → W2 land first (small, kill the most confusion), W3 runs
continuously behind features, W4 whenever there's slack. Nothing here blocks
feature work on either surface.


## W3 status — what is done, and how to continue

**Done (safe to build on):**
1. `@tailwind base/components/utilities` emitted from `index.css`, placed after the
   font `@import` and before the app's own rules, so existing selectors still win
   at equal specificity.
2. **`corePlugins.preflight = false`** — and it must stay off until the migration
   finishes. `index.css` ships its own reset and ~8.3k lines written against
   browser defaults; preflight would restyle every heading, list, and form control
   in the app the moment it is enabled.
3. **Design tokens wired to the CSS variables** — `bg-panel`, `text-t2`, `border-b0`
   etc. compile to `var(--panel)`, `var(--t2)`, `var(--b0)`. Verified in the built
   bundle. This is the part that makes migration safe: utilities follow the
   light/dark theme switch exactly like the hand-written CSS, instead of freezing
   one theme's hex values into markup.
4. Verified zero visual change (screenshot before/after is identical) and a green
   build.

**How to migrate a component (the loop):**
1. Pick ONE component with a self-contained CSS block.
2. Replace its classes with token utilities (`bg-panel`, `text-t2`, `rounded`, …) —
   never raw hex, or theming breaks.
3. Delete that CSS block from `index.css` **in the same commit**, so the line count
   only ever goes down and there is never a second source of truth.
4. Screenshot before/after; they must match.

**Remaining:** ~8.3k lines. The `.auth-*` block (index.css ~6509+) is a good first
target — it is cohesive, and the login screen is the one view renderable without
signing in, so parity is directly verifiable.
