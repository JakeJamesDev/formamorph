# 01: Catalog Pending Preview

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Model note: one SELECT, one strip rule, route tests
Reasoning effort: medium
Repo: FormamorphServer

## What to build

Catalog rows from `GET /worlds` carry `pending_preview: { name, queued_at, thumbnail_url? }` when the listing has a pending update, for staff and the author only. The server spec (FormamorphServer `docs-internal/specs/browser-review/spec.md`) holds the contract.

## Acceptance criteria

- [ ] Staff and the author get `pending_preview` on a row with a pending update.
- [ ] Another signed-in user and an anonymous reader get no `pending_preview`.
- [ ] `name` is the pending name, or the approved name when the update does not change it.
- [ ] `queued_at` is the pending update's queue time, the value the Review queue sorts by.
- [ ] `thumbnail_url` is present only when the update holds a thumbnail, and it is the existing review thumbnail URL.
- [ ] A row with no pending update has no `pending_preview`.
- [ ] The catalog tag moves when an update is submitted, approved and rejected (catalog freshness tests).
- [ ] The stripping test fails when the field is left out of the strip rule.
- [ ] The preview is read in the catalog query, with no query per row.
