# iOS decisions (ADR-I)

Architecture Decision Records for the iOS app (`ios/`). Renumbered from the old
shared `agent/decisions.md` — the two teams collided on ADR numbers (two
ADR-0044s, two ADR-0045s existed), so iOS now uses a disjoint `ADR-I-###` space.
The original number is kept in each header for traceability. Cross-client
decisions (API shapes, Gmail pipeline, Firestore model) live in
`contracts/decisions.md` as ADR-S-###.

## ADR-I-001 (was ADR-0036) · 2026-07-16 · Native iOS app (ios/), planner-pastel design language
**Status:** Accepted
**Context:** User asked for an iOS version of the Internship Portal in Xcode on the
"iOS 27 liquid glass" design. The machine has Xcode 27.0 beta (27A5209h) with the
iOS 27.0 SDK — but xcode-select points at CommandLineTools and sudo is unavailable,
so every build exports DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer.
Mid-build, the user supplied a reference set (task-planner / wellness pastel UI) and
asked for a complete redesign to match it, starting from the Dashboard.
**Decisions:**
1. **Project layout** — `ios/project.yml` (XcodeGen) is the source of truth; the
   .xcodeproj is generated and gitignored (`cd ios && xcodegen generate`). SwiftUI,
   Swift 6, deployment target iOS 27.0, CODE_SIGNING_ALLOWED=NO (simulator only).
2. **Design language** (Theme.swift) — the planner reference: near-white canvas
   #F5F6F7, white cards (radius 22), near-black ink #16191C, pastel circular icon
   tiles (green/lavender/peach/sky, hash-stable per company), thin outlined chips,
   ONE saturated green accent #2FB56B (actions + match scores), ember orange for
   urgency. Rows are the reference's anatomy one to one: 56pt pastel circle with a
   TRACK glyph (frontend→macwindow, AI→brain, cloud→cloud, …; never a logo or
   lettermark), bold title + gray value chip, muted subtitle, no chevron. System
   Liquid Glass supplies the shell: native TabView (floating glass bar,
   .tabBarMinimizeBehavior) with selection tinted INK like the reference. The
   LOGIN screen alone keeps the web's warm-paper + serif + black pills (ADR-0028).
   This supersedes the first draft's web-token port (ink/blue #1A56F0) — the web
   and iOS apps now deliberately diverge.
3. **IA + data** — four content tabs (Home / Roles / Timeline / Settings) and NO
   search tab or nav-bar search: per user direction, search is a small pill INSIDE
   the Roles list (browsing is the primary mode). No Firebase yet. LoginView is the
   real design with sign-in stubbed; "Browse without an account" uses the PUBLIC
   catalog: PortalAPI fetches /api/internships from portal-compile-jp (Azure).
   Home = greeting header + stat chips + glowing top-match card +
   Tokyo-first/Beyond-Tokyo sections; Roles = sectioned catalog
   (Priority/Tokyo/Worldwide) with the inline search pill; Timeline = upcoming
   deadlineDate roles grouped by day (JST, per BUG-009); Settings = status + web
   links + back-to-sign-in. Editor deliberately deferred (no mobile LaTeX design).
4. **Headless verification hooks** — simulators can't be tapped from simctl, so the
   app accepts `--browse` (skip auth gate) and `--tab <dashboard|timeline|settings|radar>`
   launch arguments; screenshots via `xcrun simctl io <udid> screenshot`. Verified on
   an iPhone 17 Pro simulator (runtime downloaded via `xcodebuild -downloadPlatform iOS`).
**Consequences:** Login/Radar/Timeline/Settings/Detail still carry the first-draft
styling in places (Radar uses a plain List; detail uses glass chips) — the planner
restyle has landed on Dashboard + shared row components only. Firebase auth, the
per-user pipeline (saved/applied/rejected), and real UI tests (XCUITest instead of
launch-arg screenshots) are the known next steps. NavModel (tab selection in the
environment) exists so in-content controls can switch tabs.

## ADR-I-002 (was ADR-0038) · 2026-07-17 · iOS app rebuilt on the AI-Studio reference theme; SwiftUI + Metal + Liquid Glass
**Context.** ADR-0036's planner-pastel iOS scaffold was scrapped at the user's
request. The new source of truth is a React reference app (`zip.zip`, AI Studio
export) that already renders this product's screens — Inter on a `#F4F7F6` ground,
white cards (r20–28) with `shadow-[0_2px_10px_rgb(0,0,0,0.02)]`, 36px pastel icon
tiles, teal-600 as the match accent, slate-900 primaries, and a hand-built floating
pill nav. Requirements: match that styling exactly, use Metal shaders, Liquid Glass
is mandatory, target the iOS 27 beta.
**Decision.**
- **Deleted** `ios/InternshipPortal/**` (ADR-0036 app) and the HTML design mockups.
  `project.yml` survives; the `.xcodeproj` stays generated (xcodegen) + gitignored.
- **Tokens** (`Theme.swift`) are transcribed 1:1 from the reference's Tailwind
  classes as literal hex, so nothing depends on a Tailwind build. **Typeface: SF Pro,
  not Inter** — same grotesque skeleton at these sizes; bundling a webfont buys
  licence surface and launch cost, not fidelity.
- **IA — 4 tabs** (Home · Radar · Applications · Calendar) per the user's spoken
  spec, which differs from the reference's Home/Radar/Calendar/Profile. Profile +
  Settings is a sheet off Home's Profile card. The résumé editor stays on the web.
- **Liquid Glass**: the nav is `GlassEffectContainer` + `.glassEffect(.regular
  .interactive(), in: .capsule)`; content scrolls under it (verified refracting).
- **Metal** (`Shaders.metal`): `auroraCanvas` (drifting teal/blue value-noise +
  grain over the ground), `radarSweep` (rings + rotating wedge behind the Radar stat
  strip), `shimmer` (loading skeletons), `pressWarp` (distortion under the finger).
  All are additive over an already-correct layout — a dead shader costs polish, never
  meaning.
- **Data**: unchanged contract — Azure `portal-compile-jp`, `GET /api/internships`,
  `GET|POST /api/tracker?profile=mohamed_fuad`, optimistic writes with rollback.
**Four Metal/SwiftUI constraints found by building it — all silent failures:**
1. **float32 time.** Passing `timeIntervalSinceReferenceDate` (~8×10⁸, ulp ≈ 64) to a
   shader collapses every `fract()`/hash to a constant → the effect renders flat and
   looks "too subtle" rather than broken. `ShaderClock` now passes seconds-since-launch.
2. **Chained effects.** `.colorEffect(a).colorEffect(b)` runs only the outermost;
   aurora + grain had to merge into one pass.
3. **Raster shaders skip UIKit-backed views.** Wrapping content containing a
   ScrollView in `.colorEffect` blanks the screen — shaders stay on the background layer.
4. **`colorEffect` over `Color.clear` never runs** (no rasterisation of a fully
   transparent layer). Generated content must use the shader as a ShapeStyle
   (`Rectangle().fill(ShaderLibrary.…)`), which takes no `currentColor`.
Also: `.environment()` must sit **above** the `.sheet` modifier or presented sheets
crash with "No Observable object of type CatalogStore found" — the store is now
injected at the App level.
**Verified.** Builds clean against iOS 27.0 SDK (Xcode 27.0, Swift 6); runs on an
iPhone 17 Pro sim against live prod data (173 roles, HENNGE 99%); all four tabs +
the detail sheet screenshotted; aurora confirmed by pixel sampling (11/255 shift at
the top, flat at the bottom). Tracker is empty because the KV path holds no records
for `mohamed_fuad` — signed-in web data lives in Firestore (see ADR-0036 scope note).

## ADR-I-003 (was ADR-0039) · 2026-07-17 · iOS signs in with Firebase and reads the real Firestore tracker; SwiftUI previews
**Context.** The iOS app read the server KV path (`?profile=mohamed_fuad`), which is
empty — signed-in web data lives in Firestore under `users/{uid}/…` (ADR-0015). So the
phone showed 0 applications while the web showed 24. The Swift files also had no
`#Preview`s, so the Xcode canvas was unusable for design review.
**Decision.**
- **Registered an iOS Firebase app** (`firebase apps:create ios`) → app id
  `1:501333131661:ios:e3d159530820c85377fdc4`. The web app id CANNOT be reused: the iOS
  SDK validates the `:ios:` platform segment of GOOGLE_APP_ID. `GoogleService-Info.plist`
  is committed (public config — see secrets.md).
- **SPM via project.yml**: firebase-ios-sdk (FirebaseAuth + FirebaseFirestore ONLY — no
  Analytics/Messaging/Crashlytics; each extra product is launch time for a feature we
  don't have) and GoogleSignIn-iOS.
- **AuthService** — email/password + Google, matching the web's two providers. Firebase's
  error codes are translated to sentences a person can act on.
- **FirestoreData** mirrors firestoreData.js exactly: reads
  `users/{uid}/trackers/{profileId}.data`, resolves the profile id from the real
  `profiles` collection (owner seed `mohamed_fuad` → `primary` → first) rather than
  assuming. Records decode one-by-one so a single malformed row can't blank the tracker.
- **CatalogStore routes by session**: signed in → Firestore (the same documents the web
  writes); signed out → KV path (kept so E2E/screenshots run without an account).
  `setUser` clears the previous account's records before loading — never show account A's
  data to account B, even for a frame. The catalog stays server-global either way.
- **Previews**: `PreviewData.swift` (`#if DEBUG`) builds stores with real production-shaped
  rows and NO network, plus loading/empty/failed variants; every view file has `#Preview`s
  and Kit.swift has a full component gallery.
**Three traps, all silent:**
1. **Keychain -34018 → infinite launch spinner.** `CODE_SIGNING_ALLOWED=NO` strips all
   entitlements; Firebase Auth persists the session in the keychain, so its state listener
   never fired its first callback and the app hung on the spinner with no way out. Fixed with
   ad-hoc signing + an explicit entitlements file (`application-identifier` +
   `keychain-access-groups`). AuthService also has a 5s failsafe that falls back to the
   login form — an unreachable app is worse than an unnecessary sign-in.
2. **`Field` name collision** — the `@FocusState` enum shadowed the field view; renamed AuthField.
3. **Swift 6 `deinit` is nonisolated** and cannot touch @MainActor state; the listener handle
   is `nonisolated(unsafe)` (written once in init, read once in deinit).
**Cost.** Firebase adds real launch time: ~30s cold first launch (dyld over ~200MB of
frameworks) and ~5.7s warm to first paint, in a DEBUG simulator build. Worth watching on a
release device build before shipping.
**Verified.** Builds clean (iOS 27 SDK, Swift 6); login screen renders; config plist and the
Google callback URL scheme are both in the bundle; previews compile. **End-to-end sign-in is
unverified** — entering the account password is the user's to do, not mine.

## ADR-I-004 (was ADR-0040) · 2026-07-17 · Shaders earn their place: SDF bubble field in, radar sweep + press-warp out
**Context.** User review of ADR-0038's shader work: the radar sweep read as "a weird
radar in the background", the press-warp distortion fought every tap, and the nav's
selection was a solid capsule rather than glass. Separately: build the Companies view
the way Wabi's splash is built (SwiftUI + Metal, warping loupe over signed distance
fields), and show companies as bubbles sized by how big they are.
**Decision.**
- **Removed `radarSweep` and `pressWarp`.** Both were decoration that cost
  comprehension: the sweep put moving rings behind a stat strip that has nothing to do
  with a radar sweep, and warping the card under your finger reads as the UI
  malfunctioning rather than as feedback. Press feedback is now only the reference's
  own `active:scale-[0.98]`. Kept: `auroraCanvas` (the ground) and `shimmer` (loading),
  which both do a job.
- **Nav is real Liquid Glass in both layers** — the bar, and a second glass capsule
  marking the selection that shares one `glassEffectID` inside the
  `GlassEffectContainer`, so the material flows between tabs instead of cross-fading.
- **`bubbleField`: ONE SDF over the canvas, not N circle views.** Every bubble is
  evaluated into a single field and combined with a polynomial smooth-minimum, so
  neighbours grow a meniscus and merge. This is unreachable with per-view shaders,
  which can only overlap — the merge IS the effect. Normals come from the field's
  gradient (4 taps), the field is lifted into a dome, and the view ray is bent through
  it with real refraction (Snell via Metal's `refract`), plus rim-only chromatic
  aberration, Fresnel and one specular hotspot. Cost is bounded by canvas size, not
  company count. `glassOrb` is the single-bubble variant for the entry button.
- **Companies view = three tier clusters, top 8 each.** All 103 fit on screen and it
  was mush: 70 companies list exactly one role, so as identical minimum-size dots they
  carried no information. Clustering by tier gives the shader's merge meaning — a
  bubble fuses with its own tier. Hidden counts are always labelled ("+44 more");
  a silently truncated field would lie about the data.
- **`Internship.tier`** reads BOTH `prestigeTier` shapes, because history left two: a
  bare "1"/"2"/"3" on the global seed rows and sentences like "Japan AI startup /
  verified ATS" elsewhere. Verified against live data: "1" is NVIDIA/Nokia/Cloudflare/
  Blue Origin, "2" is Hitachi/Formlabs/Geotab, "3" is smaller firms. Picking one shape
  would drop half the catalog into an unknown bucket.
- **Bubble radius ∝ √(role count)** so four roles reads as four times the *area* of
  one — area is what the eye compares. Role count is the only "how big" signal the
  catalog actually has; headcount is not in the data, and deriving it from prestige
  tiers would be a guess dressed as a fact. Packing is a deterministic golden-angle
  spiral that shrinks-and-retries until every bubble fits (an early version dumped
  unplaceable bubbles at the centre, stacking them invisibly).
- **`-previewMode YES`** launch arg skips the auth wall for screenshots. `#if DEBUG`
  only, so it cannot exist in a release build. Mirrors the web's `VITE_AUTH_DISABLED`.
**Verified.** Builds clean (iOS 27 SDK); the field renders 3 clusters against live prod
data with real logos refracting inside the glass; nav glass verified in-simulator.

## ADR-I-005 (was ADR-0041) · 2026-07-17 · Two glass bugs: glass-on-glass greys out, and a fixed dome shoulder makes a "border"
**Context.** User review: the nav "is grayed out, not proper liquid glass — it has to
be so liquid", and the Companies bubbles "have a weird border on the edges" instead of
reading as a 3D globe like Wabi's.
**Bug 1 — glass cannot sample other glass.** The nav had `.glassEffect` on the bar AND
a second `.glassEffect` capsule for the selection nested inside it. Apple's rule (and
the community reference) is explicit: *glass cannot sample other glass; the container
provides the shared sampling region*. Nested glass has nothing to refract but its
parent, so it resolves to flat grey — precisely the reported symptom. **Fix:** exactly
one glass layer (the bar, `.regular.interactive()`), with the selection a plain capsule
riding `matchedGeometryEffect` + `.bouncy`, so it flows between tabs. The liquidity is
the material's own (press-scale, shimmer, touch-point illumination) plus content
lensing underneath — not a second sheet of glass.
Related tuning rules from the same source, worth keeping: tint is for *semantic*
meaning only and must stay subtle (heavy tint kills the lensing); `.clear` is the
variant for high-transparency contexts over colourful media, `.regular` over quiet
ground. Note glass over this app's near-white canvas will always read light — it can
only lens what is behind it.
**Bug 2 — the "border" was two mistakes, neither of them the geometry.**
1. The rim was being *painted*: the shader forced `color.a` up at the edge and mixed
   the rim toward white, tracing a bright ring around every bubble. Removed entirely.
   Solid glass just shows its contents compressed; the edge is *darker* because you
   look through more glass.
2. The dome used a fixed 26pt shoulder (`sqrt(-d / 26)`), so every bubble was a FLAT
   disc with a constant-width refracting ring at its edge — a border by construction,
   and worse the bigger the bubble. **Fix:** the SDF now carries the local radius
   alongside the distance (blended through the smooth-min by the same weight), so the
   dome is a true hemisphere: `height = sqrt(-d(2R + d)) / R`, with the lateral term
   `(R + d)/R`. That is the exact sphere normal, it scales per bubble, and the
   refraction is now continuous from centre to rim.
**Verified.** Builds clean (iOS 27 SDK). Visual sign-off left to the user by request.

## ADR-I-006 (was ADR-0042) · 2026-07-17 · Native TabView; bubble shading rebuilt to the Wabi model; splash + icon
**Context.** User review round 2: the nav "still weird — remove any double ring,
redo it from what you find online"; the orbs "don't look like Wabi's" (their
reference: bright luminous spheres, contents legible); and the app needed splash
screens.
**Nav — stop imitating the system bar; use it.** Third iteration. Glass-in-glass
went grey (ADR-0041); a plain white indicator inside the glass pill read as two
rings fighting. The conclusion is that the fluid part of Liquid Glass — the droplet
that slides/stretches between items, lensing while it moves, minimize-on-scroll —
lives in the SYSTEM TabView and is not reachable from public API. Custom bars can
only ever be a worse copy, so the app now uses native `TabView` +
`.tabBarMinimizeBehavior(.onScrollDown)` + `.tint(ink)`. Our `Tab` enum is renamed
`AppTab` because the iOS 18 TabView syntax has its own `SwiftUI.Tab` type, and
shadowing it breaks every `Tab("…")` line. TabScroll's 132pt bottom inset dropped
to 28 (the system bar contributes to the safe area).
**Bubbles — a bubble, not a marble.** Research (lensball photography, soap-film
shaders) + the Wabi hero image agree on the recipe, and it is the OPPOSITE of solid
glass on two axes: (1) the rim is BRIGHT — light wraps the silhouette in two lobes
(key + opposite caustic); darkness at the rim is what read as a border; (2) the
contents get MILD centre magnification (`offset = -outward · r · mag · (1-height)`,
mag 0.34) so the picture stays legible, laminated inside — hard Snell bending
crushed it into the rim. Plus: whisper of thin-film iridescence riding the rim (two
hue cycles per revolution), one broad sheen + one tight hotspot, 6% white haze,
rim-glow feeding alpha so meniscus bridges glow like one skin of glass. Both
shaders share one `shadeBubble()` so the field and single orbs cannot drift apart.
Contents richer too: logo 42%→56% of diameter, painted white pole removed (it
doubled the shader's highlight and looked plastic).
**Splash + launch.** `SplashView`: a merged cluster of app-glyph bubbles (same
`bubbleField` shader — the splash is made of the app's own material) over the
wordmark; fades after ~1.8s (0.6s + no motion under Reduce Motion; `-holdSplash
YES` DEBUG hook for screenshots). It also covers Firebase's session-restore beat,
so returning users never see a spinner. Static `UILaunchScreen` uses a new
`LaunchBackground` color asset (#F4F7F6) → cold start is canvas → bubbles → app
with no white flash. App icon: a CoreGraphics-rendered glass orb (1024pt; NOTE:
`NSImage.lockFocus` renders at 2x on Retina — actool rejects a 2048px file that
claims 1024, "did not have any applicable content"; `sips -z 1024 1024` fixes it).
**Verified.** Build clean; simulator screenshots of all three: native glass bar
(content lensing under it), bubble clusters with bright rims and merged glow, and
the splash. On-device feel (droplet slide between tabs, minimize-on-scroll) left to
the user.

## ADR-I-007 (was ADR-0043) · 2026-07-17 · Settings tab, Home as pipeline, serif display voice, real logos
**Context.** User review round 3: company logos missing or "elongated" in the
bubbles; wants a Settings tab (profile inside it), an avatar top-left on Home, the
greeting in the serif from the web's "Welcome back" wall, the 2×2 launcher replaced
with application stats (accepted/rejected/graph-ish), Recent applications above
Tokyo opportunities, and an iOS 27 deprecation sweep.
**Decisions.**
- **Logos, two layers of fix.** (1) Most catalog rows carry `companyDomain` but no
  `logoUrl` — the web falls back to the DuckDuckGo favicon service; iOS now does
  the same (`Internship.resolvedLogoURL` / `TrackerRecord.resolvedLogoURL`).
  (2) Square favicons drawn bare inside the lens read as stretched stickers →
  every bubble mark now rides a white circular chip (54% of diameter, clipped to a
  circle). (3) DDG **never 404s**: unknown domains get a constant grey placeholder
  icon with HTTP 200, which AsyncImage happily shows (the grey "›" bubbles). It is
  byte-identical every time (1478 B, sha256 e5db88ea2322863c…), so `LogoLoader`
  fetches Data, rejects that hash, and falls back to the tint monogram. Shared
  `LogoImage` view replaced AsyncImage in CompanyMark and BubbleContents; NSCache +
  missing-set memoise per-URL (main-actor confined — Swift 6 rejects bare mutable
  statics).
- **Five tabs**: Home / Radar / Applications / Calendar / **Settings** (gearshape).
  `SettingsView` is the former ProfileSheet promoted to a tab (identity card on
  top, then Gmail/keys/refresh/sign-out); `Route.profile` deleted. Home's avatar
  (top-LEFT of the greeting, per request) jumps to the Settings tab.
- **Home is the pipeline now.** The 2×2 launcher duplicated tabs, so it's gone.
  `PipelineCard`: one stacked status bar (width = count, legend carries numbers so
  colour is never the only signal) + Applied / Interviews / Rejected / **Heard
  back %** ((interview+rejected)/sent — there is no "offer" status; an interview is
  the strongest positive signal the data has). Section order: pipeline → Recent
  applications → Tokyo opportunities (swapped per request).
- **Serif display voice.** The web's "Welcome back" wall is serif; the iOS
  greeting, login title, and splash wordmark now use `.design(.serif)` (New York) —
  the platform serif, no bundled font.
- **Warning sweep to zero**: `isolated deinit` (SE-0371) on AuthService replaces
  `nonisolated(unsafe)`; ShimmerBox captures `progress` by value in its Sendable
  visualEffect closure.
**Gotcha:** a NEW Swift file does nothing until `xcodegen generate` — the target's
file list is baked into the .xcodeproj, so "cannot find X in scope" after adding a
file means regenerate, not a code problem.
**Status.** Builds clean through the LogoImage work except the final `.insert` fix,
which is applied but NOT rebuilt/verified — the user chose to verify themselves.
Uncommitted at time of writing.

## ADR-I-008 (was ADR-0044) · 2026-07-17 · Home to the Solace grid; Companies is a page; the market cloud packs like Wabi
**Context.** User review of round 4: the serif greeting read as "weird" against the
rest of the app; the top-left avatar promised a profile photo the app can't set;
the PipelineCard bar was not what they wanted (they pointed at the Solace
reference: greeting + streak flame + a 2×2 grid of soft cards, one carrying a
small pie); the sheet StatusPicker hid "Rejected" off the right edge; Radar had
filters but no sort; the Companies field floated as sparse dots with dead space
(they pointed at the Wabi cloud: bubbles kiss and overlap) and its rim ring on
tracked companies smeared into a colour arc; Companies opened as a sheet.
**Decisions.**
1. **Greeting is the app sans, not serif** (`Font2.title(26)`), and the avatar
   button is gone — a control that shows an identity you cannot set is a lie;
   Settings is already a tab. The flame counts THIS WEEK's applications
   (records past `saved` with `createdAt` in the last 7 days), not an all-time sum.
2. **InsightGrid replaces PipelineCard**: 2×2 cards — a pipeline donut
   (trimmed-circle strokes per status, count centred) plus Applied / Interviews /
   Heard-back% figures. Solace's shape, this app's numbers.
3. **StatusPicker is a Menu** (Picker inside), a labelled row with the current
   status as a tinted pill. All five stages visible at once; `allowsClear: false`
   for RecordSheet (tracked records move stages, they don't vanish).
4. **Radar sorts**: menu pill first in the chip row — Best match (catalog order),
   Deadline (YYYY-MM-DD string order, absent sinks), Company A–Z.
5. **Companies is PUSHED** from Applications (NavigationStack + navigationDestination,
   root keeps its custom header via toolbar(.hidden)); a company's roles stay a sheet.
   A market overview is a place; one company is a card you lift.
6. **Wabi packing**: coverage 0.34→0.52, neighbours may overlap up to 40% of the
   smaller radius (SDF smooth-min turns the intersection into a shared meniscus),
   band insets 10/6→4/3, blend 9→12. Refraction dialled down (mag 0.34→0.22,
   chroma 0.05→0.035) everywhere (field, orb, splash) — the old values smeared the
   rim into "a weird refracting portion".
7. **Status ring moved off the rim onto the logo chip** — at the rim the loupe +
   rim glow dragged it into a detached arc that read as a glitch.
8. **Calendar**: the negative-padding ink ring on selected-today removed; it
   spilled outside the cell into the event dots below.
9. **Onboarding** (`Views/OnboardingView.swift`): four pages after the splash on
   first launch only (`@AppStorage("hasOnboarded")`, launch-arg overridable for
   screenshots), paged TabView with custom dots (system page control is
   white-on-white here), each feature introduced by a glassOrb-shaded orb.
**Status.** Built clean; Home, onboarding p1, Companies page (both clusters),
Radar sort pill, and the sheet status menu screenshot-verified on the sim
(previewMode against live prod). Calendar + onboarding p2–4 verified by code
only. Uncommitted.

## ADR-I-009 (was ADR-0045) · 2026-07-17 · Web donut on Home; bubbles are their logos; Radar menus; device signing unblocked
**Context.** Round-6 feedback on ADR-0044: the pipeline card should be the WEB's
status-breakdown donut (centre total + legend counts), not a mini donut in a
square; bubbles still had "a lot of gap inside" (logo chip 54%); Radar's chips
should become Location and Language selectors (Saved dropped); building to the
user's iPhone failed with "signing issue"; and confirm the app really talks to
the production APIs.
**Decisions.**
1. **StatusBreakdownCard** (full-width, above the 2×2 grid): 96pt donut, total +
   "tracked" in the hole, legend rows `● label … count` — the web panel's shape.
   The grid gains a Rejected card; pipeline mini-donut card removed.
2. **BubbleContents chip 0.54 → 0.97** of the sphere — the picture IS the bubble
   (Wabi). Tradeoff accepted: DuckDuckGo favicons are low-res, so big bubbles
   magnify softness. Status became a presence BADGE (max(12, 0.18d), white rim,
   offset 0.27d): with a 97% chip a status ring would hug the refracting rim —
   the exact smear ADR-0044 removed.
3. **Radar controls are three menu pills** (FilterMenuPill: chip skin + chevron,
   ink fill when narrowing): Sort (unchanged), Location (All/Tokyo/Remote/
   Elsewhere — remote = workMode/location contains "remote"), Language
   (All/English-first/Japanese = !isEnglishFirst). FilterChip row + Saved filter
   dropped from Radar (Saved lives in Applications).
4. **Device signing**: the ad-hoc `CODE_SIGN_IDENTITY: "-"` was simulator-only —
   THAT was the iPhone build failure. Now `CODE_SIGN_STYLE: Automatic` +
   `DEVELOPMENT_TEAM: 74G5KQR6DG` (the personal team — NB: the "(R38YYZHMHK)" in
   the cert CN is a user id, not the team; the team is the OU). Entitlements no
   longer hardcode application-identifier (profile injects it) and the keychain
   group carries `$(AppIdentifierPrefix)`. Xcode-beta has NO Apple-ID account, so
   `-allowProvisioningUpdates` fails ("No Account for Team") — but a valid team
   profile from the user's own Xcode attempt (expires +7 days, embeds the
   keychain cert, includes device 00008130-001210600A01001C) resolves WITHOUT the
   flag. Installed via `devicectl device install app`. **Launch blocked on the
   one-time manual trust** (Settings → General → VPN & Device Management).
   Profile lives in `~/Library/Developer/Xcode/UserData/Provisioning Profiles/`;
   when it expires, re-run a device build from Xcode once (account signed in) to
   mint a fresh one.
5. **Connectivity audited live**: Azure catalog API 200/31ms (`/api/status`,
   `/api/internships` serving HENNGE first), DuckDuckGo favicons 200, Firebase
   `resume-841f9` config in the bundle; Firestore path `users/{uid}/trackers/…`
   reads the same docs the web writes. End-to-end sign-in still needs the user's
   own password — everything up to the wall is verified.
**Status.** Sim-verified by screenshot (Home donut card, Companies 97% chips +
badge, Radar menus). Device build signed+installed; awaiting user trust + login.
Uncommitted.

## ADR-I-010 (was ADR-0046) · 2026-07-17 · Splash logos, scroll-lag root cause, profile editing, JA localization
**Context.** Round-7 feedback (app now runs on the user's iPhone): splash icons
"don't match" — wanted real top-tier company logos; Applications tab's cards
blended into the background; bubble logos didn't fit; the phone felt laggy and
scrolling stuttered ("make sure it runs at 120fps"); wanted an editable profile
(photo upload) and an app-language option (default = locale, Japanese optional).
**Decisions.**
1. **Splash orbs = real companies** (Rakuten/NVIDIA/Mercari/Cloudflare/HENNGE/
   1Password/Sakana via DDG favicons), rendered by the same `BubbleContents` as
   the Companies field — one material everywhere; monogram until the favicon
   lands, cached after first launch.
2. **Applications ground fixed**: the round-6 NavigationStack painted its opaque
   ground OVER the tab's AmbientCanvas. The canvas now lives INSIDE the stack
   (RootView no longer wraps that tab).
3. **Logos inscribed, not clipped**: chip padding 0.145·d (side ≈ d/√2) so a
   square favicon's corners never cut; overlap capped at 12% of the smaller
   radius (40% ate neighbours' logos), coverage 0.52→0.46.
4. **Scroll lag root cause**: PressableCard's `DragGesture(minimumDistance: 0)`
   claimed every touch-down and fought the ScrollView pan — replaced with a real
   Button + ButtonStyle (`configuration.isPressed` scale). Also
   `CADisableMinimumFrameDurationOnPhone: true` (custom/TimelineView animation
   was 60Hz-capped on iPhone without it), and the phone now runs a **Release**
   build — the debug build (unoptimized Swift + Firebase debug) was the bulk of
   the perceived lag.
5. **Profile editing in Settings**: avatar = PhotosPicker with camera badge,
   stored device-local via `AvatarStore` (Application Support, downscaled to
   256px — Firebase Storage isn't wired and the web keeps photos in the résumé
   doc); name = pencil → alert TextField → `AuthService.updateDisplayName`
   (Firebase profile change + reload).
6. **Japanese localization**: `ja.lproj/Localizable.strings` (~150 keys),
   `CFBundleLocalizations [en, ja]`; enum labels + computed strings converted to
   `String(localized:)`, literal Texts localize by key. Settings "App language"
   row (System default / English / 日本語) writes the `AppleLanguages` override
   (+`appLanguageOverride` marker) — applies on relaunch; default follows the
   device locale, per the user.
7. **Release-build gotcha**: `#Preview` bodies compile in Release but
   PreviewData's fixtures are `#if DEBUG` — every preview section is now
   DEBUG-gated (script pass across Views/).
**Status.** Debug sim + Release device builds green; splash logos, Applications
ground, bubble fit, Settings (avatar/name/language) screenshot-verified on sim;
Release build installed on the iPhone. Uncommitted.

## ADR-I-011 (was ADR-0047) · 2026-07-17 · Logo candidate chains, profile edit page, non-wrapping language pill
**Context.** Round-8 feedback: bubble logos "too enlarged / low quality"; the
Settings pencil+camera icons looked bad — wanted the profile card to OPEN an
edit page instead; "System default" wrapped in the language pill; the
Applications list showed monograms where every other surface showed logos.
**Decisions.**
1. **Logo candidate chain** (`logoCandidateURLs` in Models.swift): Google s2
   `?sz=128` first (REAL resolutions, 96–128px — DDG favicons are 16–32px, which
   was the blur), DDG second (coverage), catalog `logoUrl` last (white
   wordmarks). `LogoLoader.load(candidates:)` walks the chain, requires HTTP 200
   (s2 404s for unknown domains now — the old "globe at 200" behaviour is gone;
   DDG's constant-hash placeholder check stays) and prefers the first image
   ≥48px, settling for smaller only if nothing crisp exists. `resolvedLogoURL`
   is gone; `CompanyBubble.logoURL` → `logoCandidates`.
2. **"Too enlarged"**: logo inside the chip 0.71·d → 0.59·d (padding 0.19), and
   lens magnification 0.22 → 0.16 everywhere — the bulge was reading as
   distortion on square marks.
3. **Applications logos**: `CatalogStore.logoCandidates(for record:)` falls
   through record → catalog-by-id → catalog-by-company-name (prefix-tolerant:
   Gmail says "micro1.ai"/"Rakuten Group", the catalog says "micro1"/"Rakuten").
   ApplicationCard/RecordSheet use it.
4. **Settings**: identity card is a NavigationLink (chevron only — no pencil, no
   camera badge) to a new `EditProfileView` page: tappable 112pt avatar +
   Change/Remove photo + name field + Save (Firebase displayName). Language
   pill: label "System", subtitle "Applies after relaunch", `.fixedSize()` +
   `lineLimit(1)` so it never wraps.
**Status.** Sim-verified (sharp bubble logos incl. Rakuten's real R and KDDI,
clean Settings card, one-line pill, HENNGE logo in Applications); Release build
installed on the iPhone. Uncommitted.

## ADR-I-012 (was ADR-0044) · 2026-07-17 · Floating orbs (metaballs out), in-app Gmail + AI keys, web red calendar, real Gmail mark
**Context.** User review round 5 with two new references (the Wabi hero cluster and
black lensball photography): bubbles still wrong — "each has to be its own bubble,
completely floating"; logos still not fitting; JA greeting broke mid-line; legacy
non-internship rows (5CA, micro1) showing; Gmail tag used a generic envelope; the
calendar's selection should match the web's red; "+N more" was a dead label; and
Settings still punted AI keys and Gmail to the web. Merged origin/main first (12
commits: reapply-cooldown, isInternship filtering, editor overhaul) plus the local
parallel session (logo candidate chains, insight-grid Home, ja.lproj).
**The bubble verdict: metaballs OUT, floating orbs IN.** The SDF field was the
technically interesting answer and the visually wrong one — merged skins read as
smeared borders, never as bubbles. The Wabi hero is plainly independent spheres
overlapping in DEPTH: large behind, small in front, each with its own shading and
shadow. New rendering: per-bubble `GlassOrb` views painted large→small, ~18%
shallow overlap so small ones tuck in front, per-orb drop shadow, out-of-step bob
seeded from the company id. `glassOrb` rewritten to the lensball recipe: key
CRESCENT hugging the upper rim + fainter warm counter-crescent below + one hard
hotspot + belly shade for weight + gentle centre magnification — and deliberately
NO uniform rim ring (a ring traced around the silhouette is precisely what kept
reading as a border). `bubbleField`/`smin`/`fieldSDF` deleted; the splash now uses
the same floating orbs, so it stays the same material as Companies.
**Other decisions.**
- "+N more" is a button → `TierListSheet`: every company in the tier as a list
  (mark, name, role count, status) feeding the same roles sheet as the bubbles.
- Legacy non-internships: the server filters only NEW mail (sync.js drops
  `!verdict.isInternship` since the July audit), so 5CA/micro1 must leave by hand —
  RecordSheet gained "Remove from tracker" (confirm dialog → `store.removeRecord`).
- Real Gmail mark: `GmailMark` ports the web's GmailMark.jsx SVG paths to a Canvas
  (five fills, 48×48 space) — used in ApplicationCard, RecordSheet, Gmail settings.
- Calendar matches the web: SELECTED day = red disc/white text; today unselected =
  soft red wash + red numeral. (Previously today owned the red and selection was ink.)
- JA greeting: `\n` before the name in all three ja.lproj greetings — 「こんにちは、」
  then 「Mohamedさん」 on its own line.
- **In-app instead of web:** `AIKeysView` reads/writes the SAME Firestore doc as
  the web (`users/{uid}/settings/app`: openrouterKey/searchModel/auditModel,
  merge-write, key never echoed back); `GmailSettingsView` drives the server's
  OAuth endpoints (status/auth-url/disconnect) with browser-based consent and a
  short status poll after connect. The ONLY remaining web handoff is the résumé
  editor (a LaTeX+PDF pipeline is a desktop tool); "Open the web portal" row is gone.
**Verified.** Builds clean, zero project warnings. Visual sign-off left to the user
by request. NOT yet ported: the Gmail→Firestore drain loop (web/Azure still does
ingestion; iOS manages the connection only).

## ADR-I-013 (was ADR-0045) · 2026-07-17 · The drain moves into the app; a deterministic gig guard; brand-field bubbles
**Context.** Device testing found: rejected showed 1 when the inbox has 9; micro1
(a gig platform) was tracked despite the isInternship rule; logos looked low-quality
and "pasted on"; bubbles wanted drag-with-snap-back; the status donut wanted an RGB
palette; splash should play every launch while under review.
**Two data bugs, one root each — found by reading prod, not by guessing.**
1. **The 41-action queue.** `pending` held 41 classified actions (9 rejected, 13
   applied, 19 interview) that nothing had applied. The server only QUEUES; the web's
   `useGmailInbox` was the ONLY drain, so a phone-only user's tracker froze at
   whatever the web last ingested. Fixed by porting the drain: `GmailDrain.swift`
   mirrors useGmailInbox.js rule-for-rule (one record per company, monotonic status,
   `gmail-<msgId>` milestone ids, ack-even-when-skipped so the queue can't wedge),
   runs detached after every `load()`, and is exposed in Settings as "Sync now" /
   "Rescan last 90 days". One tracker write per drain, not one per action.
   NOTE: prod backfill exceeds Azure ingress's 240s cap and returns 504 while the
   server keeps working — so sync-now is fire-and-forget and the drain reads the
   queue afterwards rather than trusting the response.
2. **micro1/5CA/Turing.** Not a code bug: the prompt states the rule correctly and
   gpt-5-nano answers `isInternship: true` anyway. A rule we can state exactly should
   not be delegated to a cheap model's judgement, so `looksLikeGig()` (classify.js)
   and `GigFilter` (iOS) now override the model — role regex (language expert, LLM
   trainer, annotation, customer support, quality analyst…) + gig-platform names
   (micro1, 5CA, remotasks, appen, outlier). Every entry corresponds to a wrong
   record observed in the real inbox. Unit-checked against the live queue: blocks
   micro1/5CA/Turing, keeps HENNGE/Rakuten/ABEJA/ispace. The model proposes, the
   guard disposes. Both sides carry it because both write the same records; iOS's
   copy is what's live today (the server's ships on the next Azure deploy).
**Design.**
- **RGB pipeline**: rejected=red-500, interview=green-600, applied=blue-600; the
  pre-send stages (saved=slate, applying=amber) stay OFF the primary axis so the
  three outcomes that matter own it. Home's insight tiles speak the same language.
- **Brand-field bubbles**: `LogoLoader` samples each logo's own background from its
  EDGE ring (the average of a logo is the mark mixed with its field — Cloudflare
  came back muddy brown; the edge IS the field) and rejects a busy/transparent ring
  rather than guessing. That colour fills the sphere edge-to-edge; marks that bring
  a field are no longer inset. The white-chip-inside-a-pastel-ball look is gone.
- **Drag + snap**: rubber-banded pull (resistance grows with distance), lift (scale
  + longer shadow), bob pauses while held, bouncy spring home — the cluster is where
  the bubble belongs and the snap says so.
- **Splash**: 2.6s on EVERY launch during the debugging phase; comment marks the
  line to revert before shipping.
**Verified.** Builds clean; signed with the personal team and INSTALLED on the
paired iPhone 15 Pro. Runtime behaviour is the user's to check.
## ADR-I-014 · 2026-07-18 · Loss-proof tracker writes + drain parity + configurable base URL

Three coupled fixes so the split can't corrupt shared data:
- **Unknown-field passthrough.** `TrackerRecord`/`Milestone` decode known fields
  and capture everything else into `extra: [String: JSONValue]`, re-emitted on
  encode. Before this, every iOS save silently erased web-only fields
  (reapplyAfter/Months/Note, sourceMeta, appliedAt/rejectedAt/interviewAt/
  offerAt, milestone timeZone/createdAt) because saves write whole records.
  Binding rule now in contracts/tracker-record.md.
- **Drain parity.** applyGmailActions writes the same drain-time stamps the web
  writes (eventAt, per-kind status stamps, sourceMeta, reapply cooldown per
  contracts/normalization.md §4–5), so a record drained by the phone is no
  poorer than one drained by the browser. Stamps live in `extra` — iOS doesn't
  render them yet, but it must write and round-trip them.
- **Base URL is config.** `PortalAPIBaseURL` in Info.plist (project.yml), read
  at launch with the literal as fallback — a web-side infra change becomes a
  config bump instead of a dead shipped binary.

