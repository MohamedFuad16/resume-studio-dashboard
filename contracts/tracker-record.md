# TrackerRecord — the full field union

One tracker document per profile: a map of `recordId → TrackerRecord`, stored at
`users/{uid}/trackers/{profileId}.data` (Firestore) or `/api/tracker` (KV
fallback). Both clients read and write **whole records**, so both must know the
complete field set — or at minimum round-trip what they don't model.

## Fields

| Field | Type | Written by | Read by | Notes |
|---|---|---|---|---|
| `internshipId` | string | both | both | record id; catalog id or `gmail-<slug>` |
| `company` | string | both | both | |
| `role` | string | both | both | |
| `location` | string | both | both | |
| `deadline` | string | both | both | display text, `"Not stated"` default |
| `deadlineDate` | `YYYY-MM-DD` | both | both | drives calendar deadline events |
| `applyUrl` | https URL | both | both | must be https (validation.js rejects http on the KV path) |
| `companyDomain` | string | both | both | logo resolution |
| `logoUrl` | string | both | both | |
| `status` | enum | both | both | `saved · applying · applied · interview · rejected` — see normalization.md for ranks |
| `source` | string | both | both | `"gmail"` = derived from mail; anything else is hand-added and must survive a Gmail rebuild |
| `createdAt` / `updatedAt` | ISO 8601 | both | both | **email dates for Gmail rows, never the drain clock.** createdAt = first email (application), updatedAt = latest email |
| `milestones[]` | array | both | both | `{id, kind, date, time, title}` + web adds `timeZone` (`Asia/Tokyo`) and `createdAt` per milestone. Deterministic id `gmail-<messageId>` for drained interviews |
| `eventAt` | ISO 8601 | both | web | latest Gmail event's email date |
| `appliedAt` / `rejectedAt` / `interviewAt` / `offerAt` | ISO 8601 | both | web | per-status stamps from the email that carried that event |
| `sourceMeta` | object | both | web | `{gmailMessageId, receivedAt, subject}` of the last applied action |
| `reapplyAfter` | `YYYY-MM-DD` | both | web | earliest reapply date; company-wide cooldown |
| `reapplyMonths` | `{min, max}` | both | web | stated window |
| `reapplyNote` | string | both | web | human phrasing, built from the formula in normalization.md |

## The round-trip rule (binding on every client)

A client that decodes a record and saves it back MUST preserve fields it does
not model. iOS implements this with a passthrough (`TrackerRecord.extra` —
unknown keys captured on decode, re-emitted on encode). The web models all
fields natively. **History:** before 2026-07-18, iOS decoded only 14 fields and
its saves silently erased `reapplyAfter`, `sourceMeta`, per-status stamps, and
milestone `timeZone`/`createdAt` for every record. Any new client-side model
must ship with passthrough from day one.

## Write discipline

- Whole-map, single-write saves (one Firestore set / one POST per user action or
  drain) with rollback on failure — never per-record partial writes.
- Status changes are **monotonic** during a Gmail drain (normalization.md);
  manual user edits may set anything.
