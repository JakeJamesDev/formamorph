# 01: Catalog Pending Preview

Status: done
Base: ebecf4e
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Model note: one SELECT, one strip rule, route tests
Reasoning effort: medium
Repo: FormamorphServer

## What to build

Catalog rows from `GET /worlds` carry `pending_preview: { name, queued_at, thumbnail_url? }` when the listing has a pending update, for staff and the author only. The server spec (FormamorphServer `docs-internal/specs/browser-review/spec.md`) holds the contract.

## Acceptance criteria

- [x] Staff and the author get `pending_preview` on a row with a pending update. (pendingUpdates.test.js: "gives staff and the author the pending name, queue time and thumbnail")
- [x] Another signed-in user and an anonymous reader get no `pending_preview`. ("never gives another signed-in user or an anonymous reader the preview")
- [x] `name` is the pending name, or the approved name when the update does not change it. ("names the approved name when the update leaves it alone")
- [x] `queued_at` is the pending update's queue time, the value the Review queue sorts by. (equals `pending_updates.queued_at` in the first test)
- [x] `thumbnail_url` is present only when the update holds a thumbnail, and it is the existing review thumbnail URL. (present in the first test, absent in the description-only edit)
- [x] A row with no pending update has no `pending_preview`. ("leaves a row with no pending update without a preview")
- [x] The catalog tag moves when an update is submitted, approved and rejected (catalog freshness tests). (catalogFreshness.test.js, three cases, plus one where only the pending name changes)
- [x] The stripping test fails when the field is left out of the strip rule. (removed the `delete`; "never gives another signed-in user..." failed)
- [x] The preview is read in the catalog query, with no query per row. (`LEFT JOIN pending_updates` in `World.getAll`; read from the code)

## Landed

**Not verified**

- None.

**For you**

- Nothing for a player to judge. The client reads the field in its own tickets.
