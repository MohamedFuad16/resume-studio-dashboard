# HANDOFF — to the web-side Claude Code session (read fully before your next commit)

The repo has been restructured to end the two-team collision (duplicate ADR
numbers, contradictory state entries, drifting duplicated logic). This file is
your one-time migration guide. Delete it after completing every step.

## What changed (already committed on the `ios` branch)

- `agent/` split: your docs moved to **`agent/web/`** (same content, your ADR
  numbering untouched); iOS docs live in `agent/ios/` (renumbered `ADR-I-###`
  so numbers can never collide again).
- **`contracts/`** created — the shared surface (API routes, TrackerRecord
  union, Gmail action shape, Firestore paths, normalization algorithms) is now
  written down. Change protocol: `contracts/README.md`.
- `CLAUDE.md` rewritten as the two-surface router. `HANDOFF-WEB.md` = this file.
- The `ios` branch also contains all iOS app work plus server-side Gmail fixes
  (already deployed — see "Already in production" below).

## Your one-time steps

1. Commit or stash anything in progress.
2. `git fetch origin && git checkout main && git pull`
3. `git merge origin/ios`
   - origin/main was merged into the ios branch first, so this should be clean
     or near-clean. If `agent/state.md` / `agent/decisions.md` conflict
     (you committed new entries after this handoff was written): your new
     entries belong in `agent/web/state.md` / `agent/web/decisions.md` — move
     them there, `git rm` the old root files, commit the merge.
4. `git push origin main`
5. Create your working branch: `git checkout -b web && git push -u origin web`.
   From now on: work on `web`, merge `main` in regularly, merge to `main` when
   stable. Do not commit directly to `main` anymore.
6. Read `contracts/README.md` + `contracts/CHANGELOG.md` (5 minutes, it will
   save you real pain).

## Action items for your side (from contracts/CHANGELOG.md, prioritized)

1. **Adopt the canonical company key** (`contracts/normalization.md` §1):
   extend `CORP`/`slug` in `editor/src/hooks/useGmailInbox.js` and
   `editor/src/utils/reapplyCooldown.js` to also strip EN corporate suffixes
   (", inc." " ltd" " k.k." " co."…). Today `"Acme, Inc."` creates different
   record ids depending on which client drains first.
2. **`validation.js` fixes** (`contracts/api.md`): the tracker-key regex
   `/^[a-zA-Z0-9_-]{1,80}$/` 400s the ENTIRE save when a record id contains CJK
   (`gmail-株式会社カナリー`); and `cleanHttpsUrl` throws on `http://` URLs that
   your own enrichment can produce — clean at ingest instead of failing the save.
3. **Retire client-side company-name filters** (ADR-S-002 in
   `contracts/decisions.md`): the owner's directive is no hardcoded companies
   anywhere. Detection is server-side and evidence-based now (see below) — your
   micro1/gig name filters should come out; if junk still reaches the queue,
   fix `classify.js`, don't filter names downstream.
4. `.dockerignore`: add `ios` (it's uploaded as build context today for nothing).
5. Optional but wise: move `VITE_API_BASE_URL`-style config notes into
   `contracts/api.md` if they change.

## Already in production (deployed from the iOS side — now yours to own)

`portal-compile-jp` (japaneast) runs image **`portal-compile:32fc6ae`**
(revision 0000011). It contains, relative to what you last deployed:

- **Quote-grounded internship detection** (`server/gmail/classify.js`): the
  model must quote the email's own words as evidence; the quote is verified
  punctuation-folded. Verified against the real inbox: 80 scanned → 20 real
  internships queued, 23 gig/support mails dropped, 37 non-application.
- **`receivedAt` normalized to ISO 8601** (`server/gmail/sync.js` `toISO`) —
  iOS cannot parse RFC 2822; never revert.
- **Sync observability**: every sync logs
  `gmail-sync[profile] listed= fresh= queued= dropped={…}` (counts only).

⚠️ There are TWO container apps in `internship-portal`: `portal-compile`
(westus2) and `portal-compile-jp` (japaneast). **-jp is the live one** — it
holds the Gmail token/queue on Azure Files. Verify `VITE_API_BASE_URL` points
at -jp and correct `docs/azure-deploy.md` if it still names the other app.
Server code is web-owned from here on: future deploys are yours; the iOS side
will request server changes via `contracts/CHANGELOG.md` instead of deploying.

## What the iOS side already fixed so your data survives

iOS used to decode only 14 TrackerRecord fields and its saves silently erased
your `reapplyAfter`/`reapplyMonths`/`reapplyNote`, `sourceMeta`, per-status
stamps, and milestone `timeZone`/`createdAt` on every sync. As of the `ios`
branch: iOS round-trips unknown fields (passthrough) AND writes the same
drain-time stamps you do (`contracts/normalization.md` §4–5). Fields you add in
the future will survive iOS saves automatically.
