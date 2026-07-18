# API contract — endpoints both clients depend on

Server implementation: `editor/server/index.js` (web-owned). iOS call sites:
`ios/InternshipPortal/API.swift` + `GmailDrain.swift`.

## Base URLs

- Production (both clients): `https://portal-compile-jp.redgrass-10389803.japaneast.azurecontainerapps.io`
  - iOS reads it from Info.plist key `PortalAPIBaseURL` (set in `ios/project.yml`);
    the web reads `VITE_API_BASE_URL`. **If the container app is ever recreated,
    both configs must change — neither client hardcodes it in code.**
- ⚠️ TWO container apps exist in resource group `internship-portal`:
  `portal-compile` (westus2) and `portal-compile-jp` (japaneast). **-jp is the
  live one**: it holds the Gmail connection + queue state on Azure Files
  (`internshipportaljpdata/resume-studio-data`). Deploys must target -jp.

## The endpoints iOS calls (9 of the server's ~30)

| Method + path | Purpose | Notes both sides must honor |
|---|---|---|
| `GET /api/internships` | shared catalog | Response `{items:[Internship], meta}` — iOS also tolerates a bare array. Renaming `score`, `prestigeTier`, `languageType`, `companyDomain` breaks Radar sort, tier bucketing, and logos. |
| `GET /api/tracker?profile=` | tracker (KV fallback, signed-out/E2E only) | Map of id → TrackerRecord. |
| `POST /api/tracker?profile=` | save tracker (KV fallback) | Body `{data: {id: record}}`. `validateTracker` (validation.js) gates it: tracker **keys** must match `/^[a-zA-Z0-9_-]{1,80}$/` (CJK keys 400 the whole save — open issue, see normalization.md), and `applyUrl` must be https (an `http://` URL from enrichment 400s the save). |
| `GET /api/integrations/gmail/status?profile=` | connection status | `{configured, connected, email, lastSyncAt, lastError, autoApply}` |
| `GET /api/integrations/gmail/auth-url?profile=` | begin OAuth | Consent completes in the browser; the server keeps the token. Clients only poll status afterwards. |
| `POST /api/integrations/gmail/disconnect?profile=` | disconnect | |
| `POST /api/integrations/gmail/sync-now?profile=&backfill=N` | trigger a scan | `backfill` capped at 180 server-side. A backfill outlives the request — Azure's gateway 504s at 240s while the server keeps scanning, so clients fire-and-poll rather than await. Result readable only in container logs (`gmail-sync[profile] listed= fresh= queued= dropped=`). |
| `GET /api/integrations/gmail/pending?profile=` | read the queue | `{actions: [GmailAction]}` — shape in gmail-action.md. |
| `POST /api/integrations/gmail/ack` body `{ids}` | remove applied actions | |

`?profile=` is the **server KV profile key**; by convention it equals the
Firestore profile document id (see firestore.md). Default `mohamed_fuad`.

## Change protocol

Any change to these routes' paths, params, status codes, or response shapes is
a contract change → CHANGELOG.md + the other side reacts before shipping.
