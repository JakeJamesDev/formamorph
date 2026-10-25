# 01: Hold New Listings

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: the server spec, `docs-internal/specs/listing-review/spec.md` in FormamorphServer (Moderation state on a listing, Submission paths, Setting)

Model rationale: one state reaches every read path, including raw SQL that skips the shared check. A missed path leaks unreviewed content.

## What to build

With the `listing_review` setting on, a new listing from a normal author is `pending`. Only its author and staff can see it, on every read path. Staff uploads skip review and write an audit entry. With the setting off, nothing changes for anyone.

This ticket owns the "skips review" check (staff only here; ticket 04 adds trusted authors) and the audit log's `target_id` column. The queue and approval are ticket 02.

## Acceptance criteria

- [ ] A schema step adds `moderation_state`, `moderation_queued_at` and `listed_at` to `worlds`, backfills `approved` and `listed_at = created_at`, and is idempotent.
- [ ] The audit log gets a nullable `target_id` column through a schema step.
- [ ] `listing_review` is declared, defaults to `false`, and a per-key `adminOnly` flag refuses a mod's write.
- [ ] `GET /api/reviews/meta` answers `{ enabled }` to anyone.
- [ ] Review on: a normal author's new listing is `pending` with `moderation_queued_at` set; a staff upload is `approved` and writes `listing_auto_approved` with `target_id`.
- [ ] Review off: every new listing is `approved` with `listed_at` now.
- [ ] A `pending` listing answers `404` or is absent for a player on: the catalog (`getAll`), read by id, download, dependency resolution, add-on offers (`Compatibility.worldsFor` selects the new column), the follows feed and unread count, author listings and totals, the podium, and report filing.
- [ ] The author and staff still see it on those paths.
- [ ] `moderation_state` and `moderation_queued_at` never reach a player's payload.
- [ ] The catalog's "newest" sort reads `listed_at`.
- [ ] Each visibility filter is proven by reverting it once and watching its test fail.
- [ ] `CONTEXT.md` gains the new glossary terms from the spec.
