# 01: Anonymous Like route and summed count

Status: in-progress
Base: b37a29e7
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Server)

Model rationale: new table, new route, and a count change that reaches four read paths and the sort. One wrong join changes every public number.

## What to build

A request with an Install header and no token sets or clears an **Anonymous Like** on a listing. A new setting gates the route and is off by default. Every public count becomes the sum of account Likes and Anonymous Likes. A guest request that carries an Install header gets its `liked` flag.

The cap, the Claim, and the linked-account guards are tickets 02 and 03. This ticket leaves room for them and builds none of them.

## Acceptance criteria

- [ ] A new table holds Anonymous Likes: listing, Install id, address hash, browser family, created time. One row per listing and Install. It cascades with the listing. The schema step is idempotent.
- [ ] The hash uses the Signal salt, the shared client-address resolution, and the shared browser-family function.
- [ ] The route answers with the liked state and the summed count, in the shape the account like route returns.
- [ ] The route refuses, each with a distinct code: setting off; listing not visible (the existing visibility check); missing or malformed Install header.
- [ ] Setting it twice and clearing it twice are both safe.
- [ ] The sum appears in the catalog select, the single-listing count, the Likes sort, and the author totals. Author totals keep their public-only rule.
- [ ] The staff Likers list and the likes-given list stay account-only.
- [ ] A guest catalog or detail request with an Install header gets `liked`; without the header the flag stays absent.
- [ ] The Install header is on the CORS allow list, and responses that read it vary on it. A preflight test proves it.
- [ ] A route limiter keyed by client address covers the account like route and the new route.
- [ ] The new setting is declared with a validator and defaults to off. No public settings read is added.
- [ ] The catalog list response and the listing detail response each carry a top-level `anonymousLikes` boolean that follows the setting, the same for every viewer. A test proves it on both.
- [ ] With the setting off, stored Anonymous Likes still count.
- [ ] Tests run through HTTP over the in-memory database. Each guard has a test that fails when the guard is removed.
