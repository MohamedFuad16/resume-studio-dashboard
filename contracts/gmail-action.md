# Gmail pipeline — action shape, queue semantics, detection policy

The server reads the inbox and QUEUES actions; clients drain the queue and apply
them to the tracker. The server never touches user tracker data (it can't — the
tracker lives in client-direct Firestore).

Server side: `editor/server/gmail/{sync,classify,store,oauth,gmailClient}.js`
(web-owned). Client drains: `editor/src/hooks/useGmailInbox.js` (web, 90s poll)
and `ios/InternshipPortal/GmailDrain.swift` (iOS, on load + foreground).

## GmailAction (queue entry)

```
{
  id:             "gmail-<ts>-<n>",          // ack handle
  dedupeKey:      "<gmailMessageId>:<kind>", // queue-level dedupe
  gmailMessageId: string,
  threadId:       string,
  receivedAt:     ISO 8601,   // ← GUARANTEED ISO (sync.js toISO). The email's
                              //   Date header is RFC 2822; the server normalises
                              //   because iOS's ISO8601DateFormatter can't read
                              //   RFC 2822. Do not revert.
  kind:           "applied" | "rejected" | "interview" | "offer" | "other",
  company:        string,
  role:           string,
  interview:      { date: "YYYY-MM-DD", time: "HH:mm"|null } | null,
  reapplyMonths:  { min: int, max: int } | null,   // from a rejection's stated wait
  enrichment:     { url, location, deadline, deadlineDate } | null
}
```

## Queue semantics

- `pushQueue` dedupes by `dedupeKey` against the current queue only — a
  re-scan (backfill) re-offers already-acked mail, which is safe because both
  clients apply idempotently (deterministic ids, monotonic status).
- Clients **ack every action they see, including ones they skip** — an unacked
  action is re-offered forever.
- **Dual-drainer rule:** both clients drain the SAME queue; whoever acks first
  wins. This is only safe while both apply the SAME rules — which is why
  normalization.md exists and why both implementations must track it exactly.

## Detection policy (owner directive — binding)

What is and isn't an internship is decided **server-side, by evidence, never by
company name**. `classify.js` requires the model to QUOTE the words that make an
email an internship; `internshipEvidenceHolds()` verifies the quote appears in
the email (punctuation-folded) and names an internship. No quote → not an
internship.

**No client may carry a hardcoded company allow/deny list.** The owner's
instruction (2026-07-18): "you should not hardcode companies — it should only
positively detect the internships." iOS removed its GigFilter for this reason;
web-side name filters (e.g. a "micro1 gig filter") should be retired in favor
of the server verdict — if the server queues junk, fix `classify.js`, don't
filter names downstream.

## Observability

Every sync logs one line (counts only, never mail content):
`gmail-sync[profile] listed=N fresh=N queued=N dropped={fetchFailed, classifierFailed, notApplication, notInternship, lowConfidence, noCompany}`.
A backfill's result is readable ONLY here — the HTTP request that started it
dies at the gateway's 240s timeout while the scan continues.
