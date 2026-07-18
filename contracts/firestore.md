# Firestore — the single user-data store

Project `resume-841f9`. Both clients talk to Firestore **directly** under
owner-only rules; the Express server has no Admin SDK and cannot read user data.
This is the design, not an accident — never route user data through the server.

## Paths

```
users/{uid}/profiles/{profileId}       resume + profile document (web seeds it)
users/{uid}/trackers/{profileId}       { data: {recordId: TrackerRecord}, updatedAt }
users/{uid}/applications/{id}          cover letters / application docs (web)
users/{uid}/settings/app               AI settings (OpenRouter key + models)
```

## Profile id resolution (both clients, identical)

`mohamed_fuad` if it exists → `primary` → first profile id (sorted). The web
**creates** the profile document on first run; iOS never creates one — a signed-in
account with zero profiles is told to open the web app once.

⚠️ The Firestore profile document id doubles as the server KV `?profile=` key
for the tracker fallback AND all five Gmail endpoints. The two namespaces are
conflated **by convention** — changing the default profile id on either side
decouples a user's Gmail connection from their tracker.

## Rules & indexes ownership

`editor/firestore.rules` + `firestore.indexes.json` live in the web tree and
deploy via `firebase deploy --only firestore:rules` from `editor/`. **They gate
the iOS app's entire data layer.** Rule changes are contract changes:
CHANGELOG.md + iOS confirms before deploy.

## Auth

Firebase Auth (email/password + Google). Both apps are registered in the same
Firebase project; the iOS app id is separate (`1:501333131661:ios:e3d1…77fdc4`,
config in `ios/InternshipPortal/GoogleService-Info.plist`, committed — API keys
in that plist are identifiers, not secrets; security is the Firestore rules).

## KV fallback

Signed-out / E2E only: tracker at `/api/tracker?profile=` on the server's
sql.js KV (Azure Files-persisted). Production users are signed in — Firestore
is the real path.
