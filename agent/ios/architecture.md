# iOS architecture

SwiftUI, iOS 27.0 target, Swift 6 strict concurrency, XcodeGen (`ios/project.yml`
is the source of truth; the `.xcodeproj` is generated output). ~7,600 lines,
24 Swift files + 1 Metal file, all under `ios/InternshipPortal/`.

## Layers

```
InternshipPortalApp (@main)
  ├─ AuthService   @Observable @MainActor → Firebase Auth (email/pw + Google)
  └─ CatalogStore  @Observable @MainActor ← the single source of truth
        ├─ PortalAPI      static struct → Azure server (base URL from Info.plist
        │                                  key PortalAPIBaseURL; contracts/api.md)
        ├─ FirestoreData  static struct → users/{uid}/… (contracts/firestore.md)
        └─ GmailDrain     @MainActor ext → queue drain + rebuild (contracts/gmail-action.md)
```

- **App entry** `InternshipPortalApp.swift` — FirebaseApp.configure, owns store +
  auth, splash → onboarding → AuthGate → RootView; drains Gmail on foreground.
- **RootView** — native five-tab `TabView` (home/radar/applications/calendar/
  settings), shared sheets, one-shot debug launch hooks (see setup.md).
- **Data** `API.swift` (PortalAPI + CatalogStore), `Models.swift` (wire models +
  `logoCandidateURLs` + `JSONValue` passthrough), `FirestoreData.swift`,
  `GmailDrain.swift`, `Auth.swift`, `PreviewData.swift` (DEBUG fixtures).
- **Views** Home / Radar / Applications / Companies (glass-orb market field) /
  Calendar / InternshipSheet / EventSheets / Settings (profile, AI keys, Gmail,
  incl. Rebuild-from-Gmail) / Login / Kit (shared components).
- **Effects** `Shaders.metal` (auroraCanvas, glassOrb — SwiftUI stitchable) +
  `ShaderEffects.swift` (`ShaderClock` float32-safe epoch, `AmbientCanvas`).
- **Theme.swift** — reference tokens 1:1 (canvas #F4F7F6, teal-600 accent,
  status palette applied=blue / interview=yellow / rejected=red).
- **LogoImage.swift** — logo.dev (domain + name, `fallback=404` load-bearing) →
  gstatic → apple-touch → DDG; largest wins; edge sampler reads the brand field
  (dominant corner-free color); `preload()` warms clusters before intros animate.
- **Notifier.swift** — local notifications for drain discoveries, with logo
  attachment; silent-baseline on first drain so the backlog never spams.

## Tracker data flow

Signed in → Firestore `users/{uid}/trackers/{profileId}.data` (whole-map reads
and writes, rollback on failure). Signed out / E2E → server KV `/api/tracker`.
Records this client doesn't fully model survive saves via
`TrackerRecord.extra` (unknown-key passthrough) — **binding rule**, see
`contracts/tracker-record.md`.

## Gmail drain

`drainGmail()` on load + foreground: status → sync-now (fire-and-poll; a
backfill outlives the 240s gateway) → pending → `applyGmailActions` (oldest
first, company convergence, monotonic ranks, web-parity stamps: eventAt /
per-status stamps / sourceMeta / reapply cooldown) → ONE persisted write → ack →
notify. `rebuildFromGmail()` purges every `source=="gmail"` row FIRST (persisted),
then re-scans and re-applies; `isRebuilding` holds the routine drains off. All
apply rules are contract-bound: `contracts/normalization.md`.

## What iOS depends on that it doesn't own

- 9 server endpoints (contracts/api.md) — server code is web-owned; iOS-driven
  server changes go through contracts/CHANGELOG.md.
- Firestore rules (`editor/firestore.rules`, web tree) gate all iOS data access.
- The catalog + Gmail queue live on `portal-compile-jp` (japaneast).
