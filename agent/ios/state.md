# iOS state

## Current state summary (2026-07-18)

SwiftUI app (`ios/`, iOS 27 SDK, Swift 6, XcodeGen) shipping to a paired
iPhone 15 Pro. Five native tabs (Home / Radar / Applications / Calendar /
Settings) over the AI-Studio reference theme; Metal aurora canvas + glass-orb
bubbles (Wabi model); Firebase Auth + client-direct Firestore tracker; the app
drains the Gmail queue itself on load + foreground and posts local
notifications with real company logos. Logos come from logo.dev (account token,
domain + name lookup) with favicon fallbacks, largest-wins. Status palette:
applied=blue, interview=yellow, rejected=red. Splash/onboarding preload logos
before animating; onboarding bubbles fly in from the sides with haptic+pop.
Debug-phase scaffolding still active: splash on every cold launch, one-shot
UserDefaults tags (`onboardingReviewTag`, `gmailRebuildTag`) that replay
onboarding / re-run the Gmail rebuild per build tag.

Known-good production facts: server `portal-compile-jp` (japaneast) runs image
`32fc6ae` with quote-grounded internship detection — verified against the real
inbox (80 scanned → 20 real internships queued, 23 non-internships dropped).

## Recent changes

- **2026-07-21 — AI Brain MCP registered for the source project.** Root `.mcp.json` points
  at this machine's local `brain-mcp` stdio server in `ai-brain-platform`, giving Claude Code
  the same search, current-ADR, convention, impact, resource, and prompt surface as Codex.
  This is developer-tool wiring only; no iOS product code or shared contract changed.

- **2026-07-21 — Company pages behind the orb expansion; records stay sheets.**
  Card-expand on Applications records doubled the chrome (RecordSheet's close
  button under the expander's — owner's screenshot), so records are SHEETS again
  everywhere and the gesture moved to the Companies orbs: tap one and it grows,
  circle-out-of-circle (`collapsedRadius` is now a function of the source frame),
  into the new `CompanyDetailView`. First ship rendered as a floating cutout —
  the overlay grew to the SAFE AREA, boxed by the nav and tab bars; it now adds
  the safe-area insets back and both bars hide while a page is up, so it lands
  edge-to-edge. The page shows only numbers that exist: catalog popularity (the
  same score that drives Radar rank), listing count, per-role history with pin
  badges, and the research-company job's summary + verified openings behind a
  button. Funding/WLB/headcount are requested from web in contracts/CHANGELOG —
  `ResearchJob.Facts` already decodes and renders the object when it ships.
  Sounds were built (synthesised AVAudioEngine pops), shipped, and REMOVED the
  same day — the owner found them weird. Onboarding feedback is haptic-only
  again; if sound returns it should be a designed asset, not math. Onboarding
  replay tag bumped to `2026-07-20a`.

- **2026-07-20 (later) — Rebuild made non-destructive after it wiped the tracker
  (ADR-I-015).** A launch migration ran `rebuildFromGmail()` unattended; it
  purged 21 rows, committed, and the re-scan returned nothing. Tracker empty.
  Recovered by triggering the backfill directly against the server
  (`listed=100 fresh=80 queued=20`) and letting the app drain the queue — all 20
  applications are back (Rakuten, HENNGE, Money Forward, LAPRAS, ispace,
  Atilika, AICE, ABEJA, enechain, Atom11, Sky).
  Two fixes, both in `GmailDrain.swift`: **order** — rebuild now polls for
  actions first and returns untouched when none arrive, purges only with the
  replacement in hand, and restores the snapshot if the apply writes nothing;
  and **concurrency** — an `isSyncing` gate on the store, because a cold launch
  fired three syncs at once (load drain, foreground drain, backfill) which raced
  on one connection record and made the backfill report `listed=0`. That empty
  listing is what turned a bad order into lost data.
  `TrackerMigrations` survives but its list is **empty**, with the rule written
  into the file: a migration must be idempotent and safe to run with the network
  down and the server returning nothing. The stale-row cleanup it was written
  for still wants doing — as an in-place repair, not a purge-and-refetch.
  Repairs are now instrumented (`os_log` subsystem
  `com.mohamedfuad.internshipportal`, category `migrations`; stdout too in Debug,
  since reading os_log off a device needs root but
  `devicectl process launch --console` carries stdout). Read it with that, not
  by guessing — three previous "fixes" looked identical to a silent bail.
  Also landed: the Gmail duration UX. Sync now / Rescan / Rebuild show a live
  stage, elapsed seconds and an honest budget ("usually about a minute · up to
  ~3 min"), driven by `store.syncStage`/`syncStartedAt`, so a rebuild started by
  something other than the button still shows progress when you open the screen.
  The footer explains WHY rebuild is slow: the server re-reads 90 days and
  re-classifies every message with quote-verified evidence while the app polls.

- **2026-07-20 — Repo agentic toolkit + the iOS static-analysis trio (ADR-S-003).**
  `.claude/` is now committed repo state shared by both devices: four subagents,
  four skills, four hooks. What matters on this side is `scripts/verify-ios.sh` —
  xcodegen, a generic-iOS build whose error count must be zero, and
  `swiftlint --strict` — run via `/preflight` before every merge to `main`. There
  is no macOS CI and there will not be one (owner's call on issue #18), so this
  script is the only thing between a Swift change and `main`. It exports
  `DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer`; without it
  SwiftLint dies loading sourcekitd, because this machine's `xcode-select` points
  at CommandLineTools.
  `.swiftlint.yml` was tuned against the 37 violations of its first real run
  rather than left at defaults — `trailing_comma`, `multiple_closures_with_trailing_closure`
  and `statement_position` are off because each fights a deliberate idiom here
  (trailing commas keep append-diffs to one line; `Button { } label: { }` is the
  standard SwiftUI shape the rule predates; the third fires wherever an
  explanatory comment sits between `if` and `else if`). Limits were raised where
  the code is honestly fine (`large_tuple` 5, `cyclomatic_complexity` 15) and
  exactly one violation was a real defect — a stray double blank in `Kit.swift`.
  `applyGmailActions` carries a local `swiftlint:disable:next cyclomatic_complexity`
  with a debt note: complexity 27 against a limit of 15, suppressed narrowly so
  the rule keeps catching anything *else* that grows that large. Placement is
  fussy — the comment must sit between `@discardableResult` and `func`, since the
  violation is reported at the `func` line; above the attribute it orphans the doc
  comment and adds a "Superfluous Disable Command" error on top of the original.
  Also confirmed here: PR #15's merged `companyKey` rewrite compiles with zero
  errors and zero warnings — the specific thing issue #18 said nobody had checked.
  `.swiftformat` and `.periphery.yml` landed too; formatter runs are `mech` jobs,
  never mixed into a feature commit, and periphery stays a doctor lens rather than
  a merge gate.
  **After pulling this, restart your session** — hook config is read once at
  session start, so the commit guard is inert in a session older than the pull.

- **2026-07-18 — Repo split executed (ADR-S-001) + loss-proof tracker writes (ADR-I-014).**
  agent/ split into ios/ + web/ with disjoint ADR spaces; contracts/ created and
  populated from both teams' audits; CLAUDE.md rewritten as the two-surface router;
  HANDOFF-WEB.md written for the web session. Branch renamed ios-local → ios and
  pushed (origin/ios-local left for web-side cleanup). Code: TrackerRecord/Milestone
  unknown-field passthrough (`extra`), drain-time web-parity stamps (eventAt,
  per-kind stamps, sourceMeta, reapply cooldown), base URL from Info.plist.
  Build verified (generic/platform=iOS).

- **2026-07-17 (round 5) — Floating orbs, in-app Gmail/keys, red calendar, Gmail
  mark (ADR-0044).** Merged origin/main (12 commits incl. isInternship + reapply
  cooldown) + committed the parallel session's local work first. Bubbles: SDF
  metaball field DELETED — independent `GlassOrb`s painted large→small with ~18%
  depth overlap, per-orb shadows and out-of-step bob (the Wabi hero is overlapping
  spheres, not merged skins); `glassOrb` = crescent highlights + hotspot + belly
  shade + mild magnification, NO rim ring. "+N more" → TierListSheet (full tier
  list). RecordSheet "Remove from tracker" for legacy non-internships (5CA/micro1 —
  server only filters new mail). `GmailMark` (web SVG → Canvas) replaces the SF
  envelope. Calendar: selected = web-red disc, today = red wash. JA greetings break
  before the name. Settings: `AIKeysView` (same Firestore doc as web) +
  `GmailSettingsView` (server OAuth status/connect/disconnect) — only the résumé
  editor still links to the web. Build clean, zero warnings; visuals to be verified
  by the user. Gmail→Firestore DRAIN not ported (web/Azure still ingests).
- **2026-07-17 (round 8 — VERIFIED, UNCOMMITTED) — Logo quality + fit, profile edit
  page, language pill, Applications logos (ADR-0047).** Logos load via a candidate
  chain (Google s2 128px → DDG → logoUrl; HTTP-200 + placeholder-hash guarded;
  prefers ≥48px) — the blur was DDG 16–32px favicons stretched over bubbles. Logo
  0.59·d in the chip, lens mag 0.22→0.16. Applications list resolves logos via
  CatalogStore.logoCandidates(for:) (record → catalog by id → by name-prefix).
  Settings card → NavigationLink to EditProfileView (avatar picker + name + Save);
  pencil/camera icons removed; language pill "System", never wraps. Release build
  reinstalled on the iPhone.
- **2026-07-17 (round 7 — VERIFIED, UNCOMMITTED) — Splash company logos, scroll-lag
  fix, profile editing, Japanese localization (ADR-0046).** Splash orbs are real
  flagship logos via `BubbleContents` (one material with Companies). Applications
  tab ground fixed (AmbientCanvas moved INSIDE its NavigationStack). Bubble logos
  inscribed (padding 0.145·d, no corner clipping), overlap 12%, coverage 0.46.
  PERF: PressableCard's 0-distance DragGesture (fought every scroll) → real
  Button+ButtonStyle; `CADisableMinimumFrameDurationOnPhone` for 120Hz; the
  perceived lag was mostly the DEBUG build — a **Release build is now installed
  on the iPhone**. Settings: PhotosPicker avatar (device-local `AvatarStore`),
  name edit via `AuthService.updateDisplayName`, "App language" row
  (System/English/日本語 → AppleLanguages, applies on relaunch) +
  `ja.lproj/Localizable.strings` (~150 keys) and `String(localized:)` across enum
  labels/computed strings. Gotcha: #Preview bodies compile in Release —
  ALL preview sections are now `#if DEBUG`-gated (new files must follow).
- **2026-07-17 (round 6 — VERIFIED on sim, UNCOMMITTED) — Web donut Home card,
  full-logo bubbles, Radar Location/Language menus, iPhone signing (ADR-0045).**
  Home: full-width `StatusBreakdownCard` (web-style donut, centre total+"tracked",
  legend counts) + Rejected card in the grid. Bubbles: logo chip 0.54→0.97 of the
  sphere (favicon softness accepted), status = presence badge (ring would smear at
  the rim). Radar: FilterChips → three `FilterMenuPill`s (Sort / Location:
  All-Tokyo-Remote-Elsewhere / Language: All-English-Japanese); Saved dropped.
  Device: ad-hoc identity was the iPhone "signing issue" → automatic signing,
  team **74G5KQR6DG** (cert CN's "(R38YYZHMHK)" is a user id, NOT the team);
  entitlements use $(AppIdentifierPrefix), no hardcoded application-identifier.
  Installed on iPhone 15 Pro (iOS 27) via devicectl using the existing team
  profile (Xcode-beta has no Apple-ID account, so -allowProvisioningUpdates
  fails; the on-disk profile suffices, expires ~Jul 23). **User must trust the
  developer profile on-device, then sign in.** Live checks: Azure API 200/31ms,
  DDG favicons 200, Firebase resume-841f9 bundled.
- **2026-07-17 (round 5 — VERIFIED on sim, UNCOMMITTED) — Solace Home, Companies
  page + Wabi packing, status menu, Radar sort, onboarding (ADR-0044).** Home:
  sans greeting (serif dropped), avatar removed, flame = this week's applications,
  `InsightGrid` 2×2 (pipeline donut + Applied/Interviews/Heard-back) replaces
  PipelineCard. StatusPicker is now a Menu row (all 5 stages visible; RecordSheet
  can't clear). Radar gained a sort pill (Best match / Deadline / Company A–Z).
  Companies: PUSHED page off Applications (roles sheet stays a sheet); packing
  goes Wabi (coverage 0.52, ≤40%-of-smaller-radius overlap, blend 12); refraction
  softened app-wide (mag 0.22 / chroma 0.035); tracked-status ring moved from the
  smeared rim onto the logo chip. Calendar's spilling selected-today ring removed.
  NEW `Views/OnboardingView.swift`: 4 first-launch pages after the splash
  (`hasOnboarded`). Screenshot-verified: Home, onboarding p1, Companies clusters,
  Radar, status menu. Launch hooks: `-hasOnboarded YES` skips onboarding.
- **2026-07-17 (night, round 4 — UNVERIFIED/UNCOMMITTED) — Settings tab, pipeline
  Home, serif voice, real logos (ADR-0043).** Logos: DuckDuckGo favicon fallback
  from `companyDomain` (`resolvedLogoURL`), white circular chips inside bubbles,
  and `LogoLoader`/`LogoImage` that hash-rejects DDG's constant grey placeholder
  (1478 B, never a 404) so unknown domains show monograms, not grey arrows. Five
  tabs (Settings = former ProfileSheet, profile card inside; `Route.profile`
  removed; Home avatar top-left → Settings). Home: `PipelineCard` (stacked status
  bar + Applied/Interviews/Rejected/Heard-back %) replaces the 2×2 launcher;
  Recent applications now ABOVE Tokyo opportunities. Serif (.design(.serif)) on
  Home greeting, login title, splash wordmark — matches the web's serif "Welcome
  back". Warning sweep: `isolated deinit` in AuthService, value-captured shimmer
  closure — zero project warnings. **State: last edit (Set.insert fix in
  LogoImage.swift) applied but not rebuilt; user is verifying and has the changes
  uncommitted.** Gotcha recorded: new Swift files need `xcodegen generate` before
  they exist to the build.
- **2026-07-17 (night) — Native TabView, Wabi bubble shading, splash + icon
  (ADR-0042).** Nav round 3: hand-rolled glass bars can only be worse copies — the
  fluid droplet/minimize behaviour lives in the system bar — so the app now uses
  native `TabView` + `.tabBarMinimizeBehavior(.onScrollDown)`; `Tab` enum renamed
  `AppTab` (shadows `SwiftUI.Tab`). Bubble shaders rebuilt to the bubble model:
  BRIGHT two-lobe rim (dark rim = the old "border"), mild centre magnification
  (mag 0.34) instead of hard Snell, rim iridescence, sheen+hotspot, shared
  `shadeBubble()` across field/orb; logo 56% of diameter, painted white pole
  removed. NEW SplashView (merged app-glyph bubble cluster + wordmark, ~1.8s,
  Reduce Motion aware, `-holdSplash` hook), `LaunchBackground` color asset (no
  white flash), CoreGraphics-rendered glass-orb app icon (gotcha: lockFocus renders
  2x — actool rejects 2048px-claiming-1024; sips it down). All three
  screenshot-verified on the sim.
- **2026-07-17 (later still) — iOS shader pass + Companies bubble field (ADR-0040).**
  Removed `radarSweep` (read as a weird radar behind the stat strip) and `pressWarp`
  (warping the card under your finger fought the tap); press feedback is scale-only.
  Nav is now real Liquid Glass in both layers with a `glassEffectID` selection that
  flows between tabs. NEW `bubbleField` shader: ONE signed-distance field over the
  canvas with polynomial smooth-min so bubbles genuinely merge (per-view shaders can
  only overlap — the merge is the effect), + gradient normals, Snell refraction,
  rim chromatic aberration, Fresnel, specular. NEW **Companies** view off Applications:
  three tier clusters (Flagships / Scale-ups / Startups), top 8 each with "+N more"
  labels, radius ∝ √(role count), deterministic golden-angle spiral packing.
  `Internship.tier` reads both `prestigeTier` shapes (bare "1"/"2"/"3" from the global
  seed AND descriptive sentences). `-previewMode YES` (DEBUG-only) skips the auth wall
  for screenshots. Kept `auroraCanvas` + `shimmer`. Builds clean; verified against live
  prod (103 companies, real logos refracting inside the glass).
- **2026-07-17 (later) — iOS: Firebase auth + real Firestore data + SwiftUI previews
  (ADR-0039).** Registered an iOS Firebase app (`1:501333131661:ios:e3d159530820c85377fdc4`;
  the web app id can't be reused — the SDK validates the `:ios:` segment).
  `GoogleService-Info.plist` committed (public config). Added FirebaseAuth + Firestore +
  GoogleSignIn via SPM in `project.yml`; `Auth.swift` (email/password + Google),
  `FirestoreData.swift` (reads `users/{uid}/trackers/{profileId}.data`, resolving the
  profile id from the real `profiles` collection), `LoginView.swift`, and an `AuthGate`.
  CatalogStore now routes by session: signed in → Firestore (same docs the web writes),
  signed out → KV path. Every view file has `#Preview`s; `PreviewData.swift` supplies
  network-free fixtures (loaded/empty/loading/failed) + a Kit component gallery.
  **Traps:** keychain -34018 from `CODE_SIGNING_ALLOWED=NO` hung the app on its launch
  spinner forever (fixed: ad-hoc signing + entitlements file + a 5s failsafe); Swift 6
  deinit can't touch @MainActor state. **Launch cost:** ~30s cold / ~5.7s warm to first
  paint in a debug sim build — check a release device build before shipping.
  **STILL UNVERIFIED: end-to-end sign-in** — needs the user to enter their own password.
- **2026-07-17 — iOS app REBUILT from the AI-Studio React reference (ADR-0038).**
  The ADR-0036 planner-pastel app was deleted at the user's request; the new theme
  source of truth is `~/Downloads/zip.zip` (React/Tailwind reference rendering these
  screens) — Inter→SF Pro, `#F4F7F6` ground, white cards r20–28, teal-600 match
  accent, floating pill nav. New SwiftUI app in `ios/InternshipPortal/`: 4 tabs
  (Home · Radar · Applications · Calendar; Profile+Settings is a sheet off Home),
  detail/record/add-event/interview-date sheets, real **Liquid Glass** nav
  (`GlassEffectContainer` + `.glassEffect(.regular.interactive())`), and 4 **Metal**
  shaders (aurora canvas+grain, radar sweep, shimmer skeletons, press warp). Same
  Azure API contract as before. Builds on the iOS 27.0 SDK (Xcode 27, Swift 6);
  verified on an iPhone 17 Pro sim against live prod (173 roles, HENNGE 99%), all
  tabs + detail sheet screenshotted. **Four silent Metal/SwiftUI traps documented in
  ADR-0038** (float32 shader clock, chained colorEffects, raster shaders vs
  UIKit-backed views, colorEffect over Color.clear) plus the `.environment()`-above-
  `.sheet()` crash. NOT yet committed to `main`; iOS tracker reads the KV path, which
  is empty (signed-in web data is in Firestore).
- **2026-07-16 — Native iOS app scaffold (`ios/`, ADR-0036).** SwiftUI app on the iOS 27.0
  SDK (Xcode 27 beta via DEVELOPER_DIR; xcodegen; .xcodeproj gitignored). Planner-pastel
  design language (near-white canvas, pastel track-glyph circles, one green accent, ink
  tab selection) over the system Liquid Glass shell; login keeps the web identity. Four
  content tabs (Home/Roles/Timeline/Settings) — NO search tab; search is an inline pill in
  Roles. Live against the public Azure catalog (Home/Roles verified on an iPhone 17 Pro sim
  via --browse/--tab hooks). No Firebase yet; Editor deferred.
- **2026-07-18 — iOS round: verified Gmail internship detection, logo.dev, calendar
  dates, splash/onboarding.** Positive quote-grounded internship detection is LIVE on
  portal-compile-jp (Azure). Verified against the real inbox: an 80-message backfill
  drops 37 as not-application and 23 as not-internship (micro1, 5CA, a never-applied
  Revolut Java SE role, Turing's gig), queueing 20 REAL internships (Money Forward,
  enechain, LAPRAS, Rakuten, HENNGE, Atom11, Sky, Atilika, ABEJA, AICE, ispace). The
  quote check folds punctuation on both sides (classify.js `fold`) after a first version
  over-rejected everything a model's trailing full stop or 「」 broke a literal substring
  test. Email dates normalised to ISO at the source (`toISO`); iOS parses RFC2822 as a
  fallback for legacy rows. Client: logos via logo.dev (account token) by domain AND by
  name (Gmail companies without a domain); edge sampler takes the dominant corner-free
  colour so rounded tiles (Nokia) fill instead of sitting as a square. Calendar emits
  Applied (createdAt) + Rejected (updatedAt) on their real days with the company logo.
  Rebuild-from-Gmail reworked: an isRebuilding flag holds off the routine auto-drain
  (which was emptying the queue first), then it polls the fast re-scan and purges +
  replaces every Gmail row. Splash no longer replays on foreground (screenshot flashed
  it). Onboarding shows a colourful floating company cluster, not one pastel orb.
  logo.dev token in Models.swift is the account's own publishable key. All committed.
