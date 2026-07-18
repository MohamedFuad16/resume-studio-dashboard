# Normalization — the algorithms both clients must implement identically

Conformers: `editor/src/hooks/useGmailInbox.js` + `editor/src/utils/reapplyCooldown.js`
(web) and `ios/InternshipPortal/GmailDrain.swift` (iOS). These rules decide which
tracker record an email lands on — if the two clients disagree, the SAME company
gets TWO records depending on which client drained first.

## 1. Company key (canonical)

```
key(raw):
  strip corporate suffixes:  株式会社 合同会社 有限会社 (株) （株）
                             ", inc." " inc." ", inc" " inc" " ltd." " ltd" " k.k." " co."
  lowercase
  keep letters, digits, and CJK (U+3040–30FF, U+4E00–9FFF); fold everything else to a space
  collapse whitespace, trim
```

Synthetic record ids are `gmail-` + key with spaces → `-`.

⚠️ **Known divergence (open):** the web's `CORP` regex strips only the Japanese
suffixes — `"Acme, Inc."` keys as `acme-inc` on web but `acme` on iOS → two
records. **Canonical = the list above (strip EN suffixes too).** Web TODO:
extend `CORP`/`slug` in useGmailInbox.js + reapplyCooldown.js to match.

⚠️ **Known server bug (open):** `validation.js` requires tracker KEYS to match
`/^[a-zA-Z0-9_-]{1,80}$/` — a CJK key (株式会社カナリー → `gmail-株式会社カナリー`)
fails and 400s the ENTIRE tracker save on the KV path. Signed-in (Firestore)
saves bypass it. Web TODO: relax the key rule or transliterate server-side.

## 2. Status rank (monotonic during a drain)

```
saved:0   applying:1   applied:1   interview:2   rejected:3
```
A drain never downgrades: an action only sets `status` when its rank ≥ the
record's current rank in this drain session. `offer` has no status of its own —
it floors at `applied`. Manual user edits are NOT rank-limited.

## 3. One record per company (resolution order)

For each action, resolve the base record in this order:
1. a record already resolved for this key **in this drain session**;
2. an existing tracker record whose key contains / is contained by this key;
3. a catalog listing matched the same way;
4. a synthetic record `gmail-<slug>`.

Backfill details opportunistically: a later email may supply the role/URL an
earlier one lacked (never overwrite a real value with a worse one).

## 4. Date + stamp rules (applied per action, from the EMAIL's date)

- `eventAt = action.receivedAt` (ISO).
- Per-kind stamp: applied→`appliedAt`, rejected→`rejectedAt`,
  interview→`interviewAt`, offer→`offerAt` = eventAt.
- `createdAt` = first email's date (sticks); `updatedAt` = latest email's date.
- `sourceMeta = {gmailMessageId, receivedAt, subject}` of the latest action.
- Actions are applied **oldest-first** so the rules above compose.

## 5. Reapply cooldown (rejections that state a wait)

When `kind == "rejected"` and `reapplyMonths.min` exists:
```
reapplyAfter  = (receivedAt + min calendar months, Asia/Tokyo) as YYYY-MM-DD
reapplyMonths = {min, max: max || min}
reapplyNote   = "<company> asks applicants to wait <min>[–<max>] months before reapplying."
```
Cooldowns are **company-wide** (the policy belongs to the company, not the
posting).

## 6. Milestone dedupe

Drained interview milestones carry deterministic id `gmail-<messageId>`; a
milestone is a duplicate if the id matches OR (kind, date, time, title) all
match. Re-draining the same email must never duplicate a calendar entry.
