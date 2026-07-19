# iOS setup — build, sign, install, debug

## Build

```
cd ios
xcodegen generate          # after adding/removing ANY file — project.yml is truth
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
xcodebuild -project InternshipPortal.xcodeproj -scheme InternshipPortal \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates \
  -derivedDataPath /tmp/claude-501/dd build
```
Xcode 27.0 beta (`xcode-select` may point at CommandLineTools — use
DEVELOPER_DIR). Swift 6 strict concurrency: task groups over @MainActor code can
trip the region-isolation checker — plain concurrent `Task {}`s are the escape.

## Signing (do not "simplify")

`CODE_SIGN_STYLE: Automatic`, team `74G5KQR6DG`, signing ON **even for
simulator**: Firebase Auth needs a keychain entitlement; with signing off,
SecItemCopyMatching fails -34018 and launch hangs on the spinner forever.
Device builds want `-allowProvisioningUpdates`.

## Install / launch (paired iPhone 15 Pro)

```
xcrun devicectl device install app --device 93274837-A06A-534E-AF15-5290C9B80023 <path>.app
xcrun devicectl device process launch --device 93274837-… com.mohamedfuad.internshipportal
```
"usage assertion requirements" error = phone locked. App args need `--` and are
NOT reliably read from UserDefaults' argument domain on device — one-shot
UserDefaults **tags** are the working pattern (below).

## Debug-phase flags & tags

- `onboardingReviewTag` — bump the literal in InternshipPortalApp.swift to
  replay first-run onboarding once.
- `gmailRebuildTag` — bump in RootView.swift to force one Gmail
  rebuild-from-scratch on next cold launch.
- `-skipNotifPrompt YES`, `-holdSplash YES`, `-previewMode YES`, `-sheet first`
  — simulator/screenshot helpers (DEBUG only).
- Splash currently replays on every cold launch (review phase) — shorten
  SplashView's timer + remove the tags before shipping.

## Firebase (from the pre-split secrets doc)

- **iOS app — added 2026-07-17.** App id `1:501333131661:ios:e3d159530820c85377fdc4`, bundle
  `com.mohamedfuad.internshipportal`, registered via `firebase apps:create ios`.
  `ios/InternshipPortal/GoogleService-Info.plist` is **committed and is not a secret**, for the
  same reason as the web config: it identifies the project, and access is gated by the
  owner-only Firestore rules. It carries the iOS API key, the OAuth `CLIENT_ID`, and the
  `REVERSED_CLIENT_ID` — the last is duplicated into `project.yml` as the Google Sign-In
  callback URL scheme, so **the two must be changed together**. Regenerate with
  `firebase apps:sdkconfig IOS 1:501333131661:ios:e3d159530820c85377fdc4 --project resume-841f9`.
  NOTE: the web app id will NOT work for the iOS SDK — FirebaseApp validates the `:ios:`
  platform segment, so an iOS app has to be registered separately.
- Firestore security rules: a signed-in user may read/write ONLY `users/{uid}` and its
  subcollections; everything else denied. Deploy with
  `firebase deploy --only firestore:rules` from `editor/`.
## Logos

logo.dev publishable token lives in `Models.swift` (`logoDevToken`) — it is a
client-side pk_ token by design. `fallback=404` on logo.dev URLs is
load-bearing (otherwise monograms beat real favicons).

## The preflight gate (required before merging to `main`)

```bash
scripts/verify-ios.sh          # or /preflight, which picks the surface for you
brew install swiftlint swiftformat            # first-time setup
brew install peripheryapp/periphery/periphery # doctor lens only, not a gate
```

Three steps: `xcodegen generate`, a `generic/platform=iOS` build whose **error
count must be zero**, and `swiftlint --strict` against `ios/.swiftlint.yml`.
This is the owner's answer to issue #18 — a local ritual instead of a macOS CI
runner — so it is the only compiled verification this surface ever gets. On
pass it prints a `Verified by` block; paste that into the commit or PR body.

Two things that will bite you if you run the tools by hand instead:

- The script exports `DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer`.
  Without it SwiftLint aborts with `Loading sourcekitdInProc.framework failed`,
  because this machine's `xcode-select -p` points at CommandLineTools.
- `swiftlint:disable:next` must sit **between** `@discardableResult` (or any
  attribute) and `func`. Placed above the attribute it suppresses the wrong line
  and you get three errors instead of one — the original, plus "Superfluous
  Disable Command", plus "Orphaned Doc Comment" if a `///` block got detached.

`.swiftformat` exists but is never run inside a feature commit; formatting
sweeps are `mech` agent jobs on their own commit, so a real diff never arrives
buried in whitespace.
