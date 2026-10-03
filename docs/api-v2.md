# API v2: what the rebuilt screens call

Written on 2026-10-03, during the UI-first phase, from the calls in
`editor/src/api/v2/http.js`. Rebuild phase 2 implements these routes on the
EC2 API. Until then the screens run on the sample adapter
(`editor/src/api/v2/mock.js`, the default in `vite dev`), which returns the
same shapes.

## Rules for every route

- Every route requires `Authorization: Bearer <Firebase ID token>`. The server
  verifies it with firebase-admin and scopes every read and write to that uid.
  No route returns another user's data, and no route works without a token.
- Errors are JSON `{ "error": "message" }` with a real status code: 400 bad
  input, 401 no or bad token, 404 not found, 409 conflict, 5xx server.
- Every LLM call is logged to the spend ledger and stops at the monthly cap
  (docs/rebuild-plan.md, "Approval gates").

## Companies

`GET /api/companies/:name?jobType=internship|new_grad|full_time`

```json
{
  "name": "HENNGE",
  "summary": "…", "summaryJa": "…",
  "whyFit": ["…"],
  "steps": [{ "title": "Coding challenge", "titleJa": "コーディング課題" }],
  "stepsSource": "posting | research | typical",
  "researchedAt": "2026-10-03T00:00:00Z"
}
```

`stepsSource: "typical"` means nobody researched this company yet and the
steps are a common flow; the UI labels them so. Never present a typical flow
as the company's own.

## Search

`POST /api/jobs/parse` with `{ "query": "AI internships in Tokyo, no experience" }`
returns the shape of `parseSearchQuery` in `editor/src/utils/searchQuery.js`:

```json
{
  "text": "…",
  "filters": {
    "jobType": "internship", "city": { "en": "Tokyo", "ja": "東京" }, "region": null,
    "languageType": null, "deadlineDays": null, "noExperience": true,
    "fields": ["ai"], "keywords": []
  },
  "chips": [{ "key": "jobType", "label": { "en": "Internship", "ja": "インターン" } }]
}
```

The server puts the LLM in front and falls back to the same rules; the client
also falls back to them when this route fails.

`POST /api/jobs/search/web` with `{ "query": "…" }` runs the research agent
(docs/rebuild-plan.md, "One research system"):

```json
{ "query": "…", "status": "ok | not_connected", "results": [{ "title": "…", "url": "https://…", "snippet": "…", "company": "…", "role": "…", "source": "…" }] }
```

## Documents

| Route | Body | Returns |
|---|---|---|
| `GET /api/documents/master` | | Master profile, shape of `masterProfileFromResume` in `editor/src/documents/tailor.js` |
| `POST /api/documents/generate` | `{ job, lang: "en" \| "ja", kind }` | Document (below), `source: "ai"` |
| `GET /api/documents` | | `[Document]`, newest first |
| `PUT /api/documents/:id` | Document | Saved document |
| `DELETE /api/documents/:id` | | `{ "ok": true }` |
| `POST /api/documents/pdf` | `{ doc, html }` | `application/pdf`; the server prints `html` with headless Chromium, A4 |

`kind` is `resume | cv | rirekisho | shokumu | cover_letter`. 履歴書 and
職務経歴書 are always Japanese.

Document:

```json
{
  "id": "doc-…", "kind": "resume", "lang": "en",
  "target": { "company": "…", "companyJa": "…", "role": "…", "jobId": "…", "url": "…" },
  "header": { "name": "…", "nameAlt": "…", "kana": "…", "email": "…", "phone": "…", "address": "…", "postalCode": "…", "dob": "…", "links": [{ "label": "…", "url": "https://…" }] },
  "summary": "…",
  "sections": [{ "id": "projects", "type": "experience | projects | education | skills | activities | text", "title": "…",
                 "items": [{ "id": "…", "heading": "…", "subheading": "…", "meta": "…", "link": "…", "bullets": ["…"], "untranslated": false }] }],
  "letter": null,
  "rirekisho": null,
  "needsTranslation": false,
  "source": "sample | ai",
  "createdAt": "…", "updatedAt": "…"
}
```

`letter` (cover letters): `{ date, recipient, greeting, paragraphs: [], closing, signature }`.
`rirekisho`: `{ rows: [{ year, month, text, heading?, end? }], licenses: [{ year, month, text }], motivation, selfPr, requests }`.

The generator may rewrite wording (STAR form, keigo) but must not add an
employer, date, degree, number or claim the master profile does not contain.
`editor/src/documents/tailor.test.js` encodes that check for the sample
version; phase 2 needs an equivalent check on the LLM output.

## Gmail mailboxes

| Route | Body | Returns |
|---|---|---|
| `GET /api/mailboxes` | | `[{ id, email, status: "connected" \| "reauth" \| "syncing", lastSyncAt, applicationsFound, addedAt }]` |
| `GET /api/mailboxes/auth-url` | | `{ url }`: Google consent for `gmail.readonly`; the callback stores an encrypted refresh token per (uid, mailbox) |
| `DELETE /api/mailboxes/:id` | | `{ "ok": true }`; revokes the token at Google |
| `POST /api/mailboxes/sync` | `{ id \| null }` | `[Mailbox]`; a manual check, which runs even while paused |
| `GET /api/mailboxes/settings` | | `{ windowDays: 30, everyHours: 3, types: ["internship", "new_grad"], paused: false }` |
| `PUT /api/mailboxes/settings` | partial settings | Settings |

The worker checks each mailbox every `everyHours` with the Gmail history API,
only for mail inside `windowDays`, and only queues the job types in `types`.

## Application record fields added in the UI phase

The tracker record keeps every field it had (the archived contract is
`git show archive/main-before-web-only:contracts/tracker-record.md`) and gains:

| Field | Meaning |
|---|---|
| `jobType` | `internship \| new_grad \| full_time`. Absent means "infer from the role text" (`editor/src/utils/jobType.js`) |
| `jobTypePinned` | `true` when the owner picked the type by hand; a sync must not overwrite it |
| `selectionProgress` | `{ "<stepKey>": { "done": true, "at": "<iso>" } }`; `stepKey` is `<n>-<slug of the English step title>` |
| `milestones[].kind = "step"` | A selection step on the calendar; its id is `step-<stepKey>` |
| `sourceMeta.mailbox` | The inbox address the application was found in |

## Planned

`GET /api/me`: everything the dashboard needs in one request (user, profile,
applications, settings), so sign-in waits on one round trip.
