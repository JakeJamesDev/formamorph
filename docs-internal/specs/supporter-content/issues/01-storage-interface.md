# 01: Server: storage interface for listing content

Status: done
Base: 4260262
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a mechanical prefactor behind an existing test suite; no new behavior.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Prefactor for ticket 09 (Q5).

## What to build

Every read and write of listing content and pending content goes through one storage interface, backed by the local disk as today. The interface also names a private Supporter content area that no static route serves. Behavior is unchanged for every existing route.

## Acceptance criteria

- [x] Listing content and pending content are read, written and deleted only through the storage interface; no controller touches the content directories directly. Grep of `src/` finds directory access only in `fileStorage.js` and the bulk copy in `backupRestore.js`.
- [x] The interface exposes a private area for Supporter content, outside every statically served directory. `supporter-private` under the storage root; "lives outside every directory a public route serves" test.
- [x] The existing listing, review and deletion route tests pass unchanged. `npm test` green; no existing test edited.
- [x] A test proves the private area is not reachable through any public file route. `tests/supporterStorage.test.js`; goes red when the private folder is pointed at the thumbnails folder.

## Landed

**Not verified**
- Traversal cases on the three file routes: each route strips to a basename, so these 404 by absence. They guard the folder placement, not the strip itself.
- `backupRestore` manifest does not count the private area, and still sizes its directories itself. Backup and restore do copy it.
- `GET /api/reviews/:id/thumbnail` now sends buffered bytes (ETag, no Last-Modified or Range). Not covered by a new test.

**For you**
- None.
