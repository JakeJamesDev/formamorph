# 01: Lower The Server World Limit To 100 MB

Status: ready-for-human
Base: ec7dd70 (FormamorphServer)
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Three constants, one message, docs, and tests in the server repository (`FormamorphServer`, a sibling of this checkout). Mechanical and fully covered by existing kind-validation tests. Sonnet is enough.

## Parent

`docs-internal/specs/publish-size/spec.md`

## What to build

The server refuses a world whose content exceeds 100 MiB, on create and on update, with the message "World content exceeds the 100MB limit". The disk write guard says the same number. The world-route body parser accepts 120mb so a world at the limit plus its envelope is not refused by the parser first. No listing is grandfathered. The server docs and the client's capability map state 100 MB.

## Acceptance criteria

- [x] The world kind's content limit is 100 MiB; entity, dictionary, and model limits are unchanged
- [x] The disk write guard is 100 MiB and its message says 100MB
- [x] The world-route JSON body limit is 120mb
- [x] A world at 100 MiB plus one byte is refused on create and on update with the exact message; a world at 100 MiB is accepted
- [x] Server docs and the client repo's server capability map say 100 MB
- [ ] Server changelog carries a backend entry — waived (see comments)
- [x] Server test suite green

## Blocked by

- None — can start immediately

## Comments

Implemented in FormamorphServer commit `998eb88` (base `ec7dd70`): `src/config/kinds.js`, `src/utils/fileStorage.js`, `src/routes/worlds.js`, `README.md`, three stale "200MB" comments in `src/app.js` and `src/controllers/worldController.js`, and boundary tests in `tests/kindValidation.test.js` (accept-at-limit, refuse-at-limit+1 on create and update, and a direct unit test on the disk write guard). Full suite: 1484 tests green, ~16-18s wall time across two runs.

This client repo's `docs-internal/specs/contest-events/research/server-capability-map.md` was updated (200MB → 100MB / 120mb) but left **uncommitted**: the repo's working tree already carries substantial unrelated uncommitted work (apparently tickets 02-05 of this same spec, in progress elsewhere), so committing here would have scooped that in. Whoever commits that other work should pick up this one-file diff too, or it can go in its own small commit first.

"Server changelog carries a backend entry" was waived for this ticket at the user's direction: FormamorphServer has no dev-facing changelog file, only a per-listing author-changelog feature (unrelated) and `docs-internal/server.md`'s Deploy log, which gets its entry only when this actually deploys.
