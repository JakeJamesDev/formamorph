# 01: Server: storage interface for listing content

Status: ready-for-agent
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

- [ ] Listing content and pending content are read, written and deleted only through the storage interface; no controller touches the content directories directly.
- [ ] The interface exposes a private area for Supporter content, outside every statically served directory.
- [ ] The existing listing, review and deletion route tests pass unchanged.
- [ ] A test proves the private area is not reachable through any public file route.
