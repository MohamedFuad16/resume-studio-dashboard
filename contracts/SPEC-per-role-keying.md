# SPEC — per-role tracker keying + company-key fixes

Working spec for a coordinated change to BOTH clients. Web implements it in
`editor/src/hooks/useGmailInbox.js` (+ `reapplyCooldown.js` for the key), iOS in
`ios/InternshipPortal/GmailDrain.swift`. Both must behave identically — that is
the entire point of this file. When the change lands, fold the rules into
`contracts/normalization.md` and delete this file.

## Why

The drain currently keys tracker records by **company alone**. The owner applies
to the same company repeatedly, so real data collapses and lies. Observed on the
owner's phone, 2026-07-20:

- Five Rakuten applications (TECH Camp AI&Data · Long-term · Entry AI Engineer ·
  TECH Camp 2026 · Engineer New Grad) became **one row reading "rejected"**.
  Three live applications were invisible.
- HENNGE: rejected (GIP) + applied (Internship) + an **interview** became one row
  reading "rejected". A real interview was hidden.
- `Ｓｋｙ株式会社` vanished entirely, interview included.

## Rule 1 — company key keeps full-width Latin

`companyKey` folds anything outside `[0-9a-z]`, hiragana/katakana and CJK
ideographs to a space. Full-width Latin (`Ｓｋｙ` = U+FF33 U+FF4B U+FF59) is
outside every kept range, so the key comes out **empty** and the action is
dropped by the `key.isEmpty` guard — silently, which is how this went unnoticed.

**Fix:** before folding, NFKC-normalize the string. That maps full-width Latin to
ASCII (`Ｓｋｙ` → `sky`), full-width digits to ASCII digits, and leaves kana and
CJK ideographs alone. Then lowercase, then apply the existing marker/suffix
peeling and folding unchanged.

- Web: `str.normalize('NFKC')`.
- iOS: `str.precomposedStringWithCompatibilityMapping`.

Apply NFKC **first**, before lowercasing — half-width katakana also normalizes to
full-width kana under NFKC, which is what we want.

**An empty key must never be silently discarded.** If a key is still empty after
normalization, log it (iOS: the `migrations` os_log category; web: `console.warn`)
with the raw company string, and skip. A dropped application is a bug, not a
routine outcome, and must leave a trace.

## Rule 2 — records are keyed by company + role

Record identity becomes the pair `(companyKey, roleKey)`.

`roleKey(role)`: NFKC-normalize, lowercase, fold every character outside
`[0-9a-z]`, kana and CJK to a space, collapse runs of spaces, trim. Empty → the
sentinel `"general"`.

Synthetic record id: `gmail-<companyKey>-<roleKey>`, spaces → `-`.
(Previously `gmail-<companyKey>`.)

The in-drain session map is keyed by `"<companyKey>|<roleKey>"`.

## Rule 3 — attaching an action that carries no role

Rejection emails frequently omit the role ("we will not be moving forward"). Such
an action must NOT create a phantom `<company>-general` row beside the real one.

Resolution order for an action whose `roleKey` is `"general"`:

1. If the company has **exactly one** record → apply to it.
2. If it has **several** → apply to the most recently `updatedAt` record whose
   status is **not** terminal (`rejected`). Rejections should land on the
   application still in flight, not on one already closed.
3. If every record for that company is terminal → apply to the most recently
   `updatedAt` one.
4. If the company has **no** record → create `<company>-general`.

An action that DOES carry a role always keys on `(company, role)` exactly, and
creates the record if absent. Never fuzzy-match one role onto another: the
company's roles are frequently near-identical strings ("TECH Camp" vs "TECH Camp
2026") and merging them is what this change exists to stop.

## Rule 4 — company matching stops being a substring test

Current code matches an existing record with
`other.contains(key) || key.contains(other)` over a dictionary's `values`, taking
`first(where:)`. Two defects: substring matching merges genuinely different
companies whose keys nest, and **dictionary iteration order is unspecified**, so
which record an action lands on varies between runs. That nondeterminism is why
the same rebuild produced different results twice.

**Fix:** match on **exact** `companyKey` equality. Iterate a deterministically
sorted collection (sort by record id) wherever a "find the existing record" scan
remains, so repeated runs over the same data produce the same result.

## Rule 5 — status ranking is unchanged

`saved 0 · applying/applied 1 · interview 2 · rejected 3`, monotonic, never
downgraded. It was never the bug — per-company collapsing was. Keep both clients
identical here.

## Migration

Existing records are keyed `gmail-<company>`. After this change they will not
match incoming `(company, role)` actions and would be orphaned beside new rows.

Re-derive once from the Gmail queue rather than rewriting ids in place — the
emails are the source of truth and a backfill reproduces every row.

**The migration must be non-destructive.** Fetch the replacement set FIRST, and
only replace once it is in hand and non-empty; on an empty or failed scan, leave
the tracker untouched and say so. A purge-then-refetch migration emptied the
owner's tracker on 2026-07-20 (ADR-I-015) — do not reintroduce that shape.

## Rule 6 — `updatedAt` is compared as an INSTANT, never as a string

Found in review, 2026-07-20. Rule 3 picks "the most recently updated record", and
both clients were comparing `updatedAt` lexicographically. That is only correct
when every stamp shares a format and offset — and it does not. Records carry
whatever `ISO8601DateFormatter.flexible` wrote on iOS, and `action.receivedAt`
straight off the wire, which is UTC `Z`. So `2026-07-19T23:00:00+09:00` sorts
*after* `2026-07-19T15:30:00Z` even though it is the EARLIER instant.

The consequence is silent and is exactly what this change exists to prevent: a
roleless rejection lands on the wrong application, marking a dead one rejected
twice while the live one still reads "applied".

**Both clients:** parse to an absolute instant and compare that. If a stamp fails
to parse, treat it as the epoch (oldest) rather than falling back to string
order, so an unparseable value can never outrank a real one.

## Rule 7 — the tie-break key must be stable

`TrackerRecord.id` is `internshipId ?? UUID().uuidString` on iOS, and
`fetchTracker` does not backfill `internshipId` from the map key. Any record
stored without that field therefore yields a **different id on every
evaluation** — a non-deterministic comparator inside the very function Rule 4
exists to make deterministic.

**Both clients:** tie-break on the tracker **dictionary/object key**, which is
stable and already the sort key, never on a derived `record.id`.

## Rule 8 — a roleless action must not capture a hand-added record

Rule 3 deliberately hunts for any record of the company, and both clients then
stamp the record `source = "gmail"`. Applied to a row the user typed by hand,
that flips it to Gmail-derived — so the next rebuild purge deletes a row Gmail
cannot re-derive. Silent, permanent, user-authored data loss.

**Both clients:** Rule 3 resolution considers only records the drain owns
(`source == "gmail"`, or a `gmail-` prefixed id). If a company's only record is
hand-added, fall through and create `<company>-general` rather than capturing it.
Never rewrite `source` on a record the drain did not create.

## Out of scope

Hand-added records (`source` other than `"gmail"`) keep their existing ids and
are never re-keyed.
