# Data models

Persistence is a single key→JSON KV store (`server/storage.js`, better-sqlite3
table `kv` — live working copy on local disk, snapshotted to the durable path per
write, ADR-0040). Keys: `profile:<id>`, `tracker:<id>`, `applications:<id>`,
`internships:catalog`, `customInternships`. Local file
`server/.data/resume-studio.sqlite`; prod = the Azure Files mount `/data`.
All writes pass `server/validation.js`. Signed-in users' data is NOT here — it
lives client-direct in Firestore `users/{uid}/**` (CLAUDE.md rule 4); this KV
holds the shared catalog, the Gmail queue, and the no-auth/E2E path.

## Résumé (`profile:<id>`) — seeded from `server/profiles/<id>.json`
```jsonc
{
  "personal": {              // a.k.a. personalInfo in some legacy paths
    "nameEn", "nameJa", "furigana", "dob", "address",
    "postalCode",            // optional string; ≤16 chars, [0-9A-Za-z spaces/-] (validation.js)
    "email", "phone", "github", "linkedin",
    "photoDataUrl"           // data:image/(png|jpeg|webp); <6MB, validated
  },
  "summary": "…",
  "education":  [ { institution, institutionJa, degree, location,
                    startDate, endDate, details } ],
  "experience": [ { company, companyJa, role, startDate, endDate,
                    bullets[], bulletsJa[] } ],
  "projects":   [ { title, tech, link, description, bullets[], bulletsJa[] } ],
  "activities": [ … ],
  "skills":     { languages, tools, frameworks, … }
}
```
- Sections `education/experience/projects/activities` must be arrays (≤100 each).
- `github`/`linkedin` must be HTTPS; photo must be a valid data URL <6MB.
- `App.jsx#normalizeResume` fills defaults so the form never sees `undefined`.

## Internship (catalog item) — `seeds/*.js`, stored at `internships:catalog`
```jsonc
{
  "id", "company", "companyJa?", "role",
  "location", "region", "country", "city", "workMode",
  "language", "languageType",        // "English-first" | "Bilingual"
  "duration", "deadline", "deadlineDate",  // deadlineDate: "YYYY-MM-DD" | null
  "compensation", "track", "score" /*0–100*/, "priority",
  "workAuth", "reasons": [],
  "fitNote", "applicationProcess?": [], "applicationProcessJa?": [],
  "eligibility?": [], "eligibilityJa?": [], "techStack?": [],
  "url", "source", "sourceUrl", "companyUrl?", "companyDomain?", "logoUrl?",
  "verifiedDate", "prestigeTier", "deadlineType"
}
```
Required on write (`validateInternship`): `id, company, role, url(https), sourceUrl(https)`.

### Catalog flow
1. `buildSeedCatalog()` = compose dated seeds → enrich → apply the latest dated audit
   (`catalog-audit-2026-07-02.js`) to patch current records and remove retired IDs.
2. `readInternshipCatalog()` validates the audited seed catalog, then merges (dedup by
   **id**) with stored live-research + non-seed entries. Retired IDs are filtered from
   live, stored, legacy-custom, and write paths so persistence cannot resurrect them.
3. `useInternshipCatalog` (client) fetches `/api/internships`, dedups by `id`,
   caches at module scope, and re-fetches on `CATALOG_EVENT`.
4. Live "company research" results (`prestigeTier === 'Live company research'`,
   `id` starts with `live-`) are added via POST and preserved across seed refreshes
   unless their exact ID is later placed in a dated retirement audit.

## Application tracker (`tracker:<id>`) — map keyed by internshipId
```jsonc
{ "<internshipId>": {
    "internshipId", "company", "role", "location",
    "deadline", "deadlineDate", "applyUrl", "companyDomain", "logoUrl",
    "status",                       // saved | applying | applied | interview
    "milestones": [ { id, kind, date:"YYYY-MM-DD", time:"HH:MM"|null,
                      timeZone:"Asia/Tokyo", title, createdAt } ],
    "createdAt", "updatedAt"
} }
```
Legacy statuses `offer`/`rejected` are mapped to `applied`.

## Applications (`applications:<id>`)
List of `{ fileName, company, jobTitle, dateLogged, status, jobDescription, notes,
coverLetter }`; cover letters are generated server-side on POST.

## LaTeX pipeline data
Static `.tex` sources in `en/` and `ja/`; compiled PDFs in `output/`. The single
canonical sample `resume.json` (`editor/resume.json`) mirrors the active profile.
