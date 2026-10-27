# 03: Server: staff Pin on listings

Status: ready-for-agent
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

- [ ] A `pinned_at` column is added through a schema step; existing rows read as unpinned.
- [ ] Only staff can Pin or Unpin; other accounts get a 403.
- [ ] Every catalog sort returns pinned listings first, newest pin first, in both a single-kind and an all-kinds read.
- [ ] Listing payloads carry the pin time, or null.
- [ ] Unpin restores the listing to its normal sort position.
