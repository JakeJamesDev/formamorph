# 05: Pending Updates

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: the server spec (Pending updates, Review routes)

Model rationale: two file stores side by side; a wrong name or a missed delete path destroys live files or leaks pending ones.

## What to build

An update to an approved listing from a normal author waits as a pending update. Players keep the approved version, files included. A mod approves it (applied at once) or rejects it (dropped). The author can discard it. This ticket covers the main update route only; ticket 06 moves the side routes.

## Acceptance criteria

- [x] A pending update table holds one row per listing at most: changed fields, file names, `submitted_at`, `queued_at`. (`pending_updates`, keyed by `world_id`; smoke table list)
- [x] Pending content and thumbnails live in their own folder under their own names. No live file is touched before approval. (pendingUpdates "keeps the approved version, files included, for players"; hold guard reverted once, 16 red)
- [x] A re-edit replaces the pending update and keeps `queued_at`. (Merges per ruling 1; "merges the edit, replaces the held thumbnail and keeps the queue place"; queued_at reset reverted once, red)
- [x] Trusted authors and staff update at once and write `listing_auto_approved`. ("applies a trusted author or staff edit at once and logs the auto-approval"; reverted once, red)
- [x] The queue lists updates with type `update` and each changed field's approved and pending values. ("lists an update with its changed fields, and counts it"; one order with new listings, sort reverted once, red)
- [x] Approve applies every field and both files in one transaction, raises `revision` once, sets `updated_at`, deletes the pending row and files, and writes `update_approved`. ("applies every field and both files, raising the revision once"; file move reverted once, red; a missing held file applies nothing)
- [x] Reject deletes the pending row and files, leaves every live file intact, writes `update_rejected`, and answers the author. ("drops it, leaves every live file intact and answers the author")
- [x] `DELETE /api/reviews/:id` lets the author discard. ("lets the author withdraw it and nobody else"; author check reverted once, red)
- [x] The author and staff get `has_pending_update` on list rows and `pending_update` on the single read; players get neither. (single read, catalog, update response; each strip line reverted once, red)
- [x] `GET /api/reviews/:id/thumbnail` serves the pending thumbnail to staff and the author; the public thumbnails route never serves it. ("serves the held thumbnail to staff and the author only", "never serves a held file from the public thumbnails route")
- [x] `deleteWorld`, `sweepQuarantine` and `eraseUser` each delete pending files. (one test per path, each reverted once, red)
- [x] Backup and restore include the pending folder. ("carry the pending directory", through `backupPending` / `restorePending`)

## Landed

Server code: FormamorphServer `ace42e0` "Add Pending Updates". Full server suite 2280/2280 in 47 s.

Also built, by spec-session ruling: `eraseUser` drops pending updates in both modes, and in keep-content mode deletes the account's waiting and rejected listings with their files. Each has a test, reverted once, red.

**Not verified**

- `createBackup` and `restoreFromBackup` call the new steps, but no test runs them whole: they write under the real `backups/` folder. Only `backupPending` and `restorePending` are tested.
- Approve, reject and discard each claim the row conditionally. A true race cannot happen in one Node tick, so no test proves the conditional.

**For you**

- Nothing a player can judge yet: the client surfaces come with tickets 08 and 09.
- Seen, not built: the queue reads each update's row once more per item. Fine at today's queue sizes.
