# 05: Pending Updates

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: the server spec (Pending updates, Review routes)

Model rationale: two file stores side by side; a wrong name or a missed delete path destroys live files or leaks pending ones.

## What to build

An update to an approved listing from a normal author waits as a pending update. Players keep the approved version, files included. A mod approves it (applied at once) or rejects it (dropped). The author can discard it. This ticket covers the main update route only; ticket 06 moves the side routes.

## Acceptance criteria

- [ ] A pending update table holds one row per listing at most: changed fields, file names, `submitted_at`, `queued_at`.
- [ ] Pending content and thumbnails live in their own folder under their own names. No live file is touched before approval.
- [ ] A re-edit replaces the pending update and keeps `queued_at`.
- [ ] Trusted authors and staff update at once and write `listing_auto_approved`.
- [ ] The queue lists updates with type `update` and each changed field's approved and pending values.
- [ ] Approve applies every field and both files in one transaction, raises `revision` once, sets `updated_at`, deletes the pending row and files, and writes `update_approved`.
- [ ] Reject deletes the pending row and files, leaves every live file intact, writes `update_rejected`, and answers the author.
- [ ] `DELETE /api/reviews/:id` lets the author discard.
- [ ] The author and staff get `has_pending_update` on list rows and `pending_update` on the single read; players get neither.
- [ ] `GET /api/reviews/:id/thumbnail` serves the pending thumbnail to staff and the author; the public thumbnails route never serves it.
- [ ] `deleteWorld`, `sweepQuarantine` and `eraseUser` each delete pending files.
- [ ] Backup and restore include the pending folder.
