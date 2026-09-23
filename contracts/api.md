# API contract — endpoints both clients depend on

Server implementation: `editor/server/index.js` (web-owned). iOS call sites:
`ios/InternshipPortal/API.swift` + `GmailDrain.swift`.

## Base URLs

- Production (both clients): `https://api.mohamedfuad.com`
  - Docker on AWS EC2 `i-09677306125d4b7ba` (Tokyo, t3.micro) behind Caddy.
    The domain is an IONOS A record on Elastic IP 3.112.141.17;
    `https://3-112-141-17.nip.io` is served as a fallback host. Data lives on
    the instance at `/srv/resumedata` (mounted as `/data`). Migrated off
    Azure Container Apps 2026-08-12; Azure was decommissioned the same day.
  - iOS reads it from Info.plist key `PortalAPIBaseURL` (set in `ios/project.yml`);
    the web reads `VITE_API_BASE_URL`. **If the backend host ever moves,
    both configs must change — neither client hardcodes it in code.**
- The old Azure hosts (`portal-compile-jp.redgrass-10389803.japaneast
  .azurecontainerapps.io` and the westus2 `portal-compile`) were deleted on
  2026-08-12 and no longer answer (checked 2026-09-24: no response). An iOS
  build installed before the 2026-08-12 host change cannot reach the server
  at all; the fix is installing a current build, not reviving Azure.

## Endpoints the clients depend on (12 of the server's 23 routes)

iOS calls every row except `automation`, which only the web's Settings uses.
The web calls all of them.

| Method + path | Purpose | Notes both sides must honor |
|---|---|---|
| `GET /api/internships` | shared catalog | Response `{items:[Internship], meta}` — iOS also tolerates a bare array. Renaming `score`, `prestigeTier`, `languageType`, `companyDomain` breaks Radar sort, tier bucketing, and logos. |
| `GET /api/tracker?profile=` | tracker (KV fallback, signed-out/E2E only) | Map of id → TrackerRecord. |
| `POST /api/tracker?profile=` | save tracker (KV fallback) | Body `{data: {id: record}}`. `validateTracker` (validation.js) gates it: tracker **keys** must match `/^[a-zA-Z0-9_-]{1,80}$/` (CJK keys 400 the whole save — open issue, see normalization.md), and `applyUrl` must be https (an `http://` URL from enrichment 400s the save). |
| `GET /api/integrations/gmail/status?profile=` | connection status | `{configured, connected, email, lastSyncAt, lastError, autoApply, aiPaused}` |
| `GET /api/integrations/gmail/auth-url?profile=` | begin OAuth | Consent completes in the browser; the server keeps the token. Clients only poll status afterwards. |
| `POST /api/integrations/gmail/disconnect?profile=` | disconnect | |
| `POST /api/integrations/gmail/automation?profile=` body `{aiPaused}` | pause/resume automatic scans | Returns the status object. 404 when not connected. |
| `POST /api/integrations/gmail/sync-now?profile=&backfill=N&manual=1` | trigger a scan | `backfill` capped at 730 server-side. While `aiPaused`, only `manual=1` scans; others return `{skipped:'ai-paused'}`. A backfill can run for minutes, longer than any client waits (iOS gives up after 45s), and the server keeps scanning after the client disconnects, so clients fire-and-poll `pending` rather than await. Result readable only in container logs (`gmail-sync[profile] listed= fresh= queued= dropped=`). |
| `GET /api/integrations/gmail/pending?profile=` | read the queue | `{actions: [GmailAction]}` — shape in gmail-action.md. |
| `POST /api/integrations/gmail/ack` body `{ids}` | remove applied actions | |
| `POST /api/internships/research-company` body `{company, profile?, resume?, apiKey?, searchModel?}` | start live company research | 202 `{jobId, company, status:'researching'}`; a job for the same company from the last 15 minutes is returned as-is (202 while researching, 200 when complete). `company` must be 2 to 80 characters (400 otherwise). Without `resume` the server reads the profile. Runs on `apiKey` when given, else the server's `OPENROUTER_API_KEY`. |
| `GET /api/internships/research-company/:jobId` | poll research | `{status: 'researching' \| 'complete' \| 'error', ...}`; 404 after a server restart (jobs live in memory). iOS decodes the result in `CompanyDetailView.swift`. |

`?profile=` is the **server KV profile key**; by convention it equals the
Firestore profile document id (see firestore.md). Default `mohamed_fuad`.

## Change protocol

Any change to these routes' paths, params, status codes, or response shapes is
a contract change → CHANGELOG.md + the other side reacts before shipping.
