# 01: Hold New Listings

Status: done
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

- [x] A schema step adds `moderation_state`, `moderation_queued_at` and `listed_at` to `worlds`, backfills `approved` and `listed_at = created_at`, and is idempotent. (bootSchema: "counts every existing listing as approved and live since it was created, once"; drift guard green.)
- [x] The audit log gets a nullable `target_id` column through a schema step. (`auditTarget` step; bootSchema: "gives the audit log a target id".)
- [x] `listing_review` is declared, defaults to `false`, and a per-key `adminOnly` flag refuses a mod's write. (listingReview.test: "is off by default", "refuses a mod" → 403.)
- [x] `GET /api/reviews/meta` answers `{ enabled }` to anyone. (Signed out and signed in, as `data: { enabled }`.)
- [x] Review on: a normal author's new listing is `pending` with `moderation_queued_at` set; a staff upload is `approved` and writes `listing_auto_approved` with `target_id`. (Read back through the author's GET and `/api/audit`.)
- [x] Review off: every new listing is `approved` with `listed_at` now. (Staff uploads log no skip with review off.)
- [x] A `pending` listing answers `404` or is absent for a player on: the catalog (`getAll`), read by id, download, dependency resolution, add-on offers (`Compatibility.worldsFor` selects the new column), the follows feed and unread count, author listings and totals, the podium, and report filing. (One test per path, signed out and as a player.)
- [x] The author and staff still see it on those paths. (The same tests read as the author and as a mod.)
- [x] `moderation_state` and `moderation_queued_at` never reach a player's payload. (Catalog, read, download, author listing, dependency listing and add-ons, signed out and as a player.)
- [x] The catalog's "newest" sort reads `listed_at`. (`sort=created_at` maps to `COALESCE(listed_at, created_at)`, per the ticket 01 ruling.)
- [x] Each visibility filter is proven by reverting it once and watching its test fail. (17 guards reverted one at a time; each failed its test.)
- [x] `CONTEXT.md` gains the new glossary terms from the spec. (All six, with the Review state cross-reference.)

## Landed

Server code: FormamorphServer `20b35a1` "Hold New Listings for Review". Full server suite 2171/2171. The review fold-ins (two comments, audit key order, the meta route's doc line) wait uncommitted in four server files.

**Not verified:**
- Nothing in the list above.

**For you:**
- Nothing a player can judge yet: the setting ships off, and the client shows nothing until ticket 07.
- Follow-ups the review named, not built here:
  - `PUT /:id/addons/:componentId/review` checks no visibility on the component, so a pending or quarantined component answers 200 to a world author.
  - `utils/worldSnapshot.js` exports every world with no state filter. It is a CLI tool today.
  - The in-circulation SQL clause is repeated in `World.getAll`, `authorTotals` and `Follow`; one shared helper would own it.
