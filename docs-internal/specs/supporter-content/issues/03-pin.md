# 03: Server: staff Pin on listings

Status: done
Base: 021e9a3
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one column, one staff route, one ordering rule, in an established route-test style.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

Staff can Pin and Unpin any listing of any kind (Q16). The catalog returns pinned listings first, newest pin first, then the requested sort. Listing payloads carry the pin time so the client can mark and order them.

## Acceptance criteria

- [x] A `pinned_at` column is added through a schema step; existing rows read as unpinned. (`pinnedAt` step; bootSchema "leaves every existing listing unpinned")
- [x] Only staff can Pin or Unpin; other accounts get a 403. (pin.test.js "who can Pin": author and plain account 403, anonymous 401, admin and mod 200)
- [x] Every catalog sort returns pinned listings first, newest pin first, in both a single-kind and an all-kinds read. (pin.test.js "catalog order": five sorts x asc/desc, `kind=all`, `kind=entity`, page 2)
- [x] Listing payloads carry the pin time, or null. (pin.test.js "payloads": catalog and detail read)
- [x] Unpin restores the listing to its normal sort position. (pin.test.js "restores an unpinned listing")

## Landed

Routes: `PUT /api/worlds/:id/pin` returns `{ id, pinnedAt }`; `DELETE` returns the same with `pinnedAt: null`. Payload field is snake_case `pinned_at`. A re-pin moves the listing to the top. Pin and Unpin write `listing_pinned` and `listing_unpinned` audit entries; an Unpin of an unpinned listing writes none.

**Not verified**
- None. Coverage numbers were not measured.

**For you**
- None.
