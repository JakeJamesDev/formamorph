# 06: Side Edits Wait For Review

Status: done
Base: 7b2c0a8
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: the server spec (Pending updates; rulings Q25, Q26)

Model rationale: six write routes each need the same detour, and the changelog needs ordered operations replayed at approval.

## What to build

On an approved listing, dependency, compatibility, spoiler and changelog edits join the pending update instead of going live. So do the visibility, dependency and compatibility writes inside the main update. During contest judging, approving an update to a contest entry waits for results.

## Acceptance criteria

- [x] `PUT /:id/dependencies`, `PUT /:id/compatibility`, `PUT /:id/spoiler`, and changelog create, edit and delete each write to the pending update (creating it if needed) for a normal author on an approved listing. ("wait in the pending update", "show the author and staff each change", "answer a changelog edit with the approved entry"; each route's hold reverted once, red)
- [x] The same writes apply at once on a `pending` or `rejected` listing, and for trusted authors and staff. ("apply on a pending listing" runs all six routes; rejected, trusted and staff tests; `holdsEdit` reverted once, red)
- [x] Players see the approved dependencies, compatibility, spoiler flag and changelog until approval. ("wait in the pending update": the listing read and `GET /:id/dependencies` as a player)
- [x] Approval applies them all in the one transaction, with one `revision` raise; rejection drops them. ("approval applies them all with one revision raise", "rejection drops them"; per spec-session ruling, a side-only update raises none: "approval of side edits alone leaves the revision and date where they were"; 5 mutations, each red)
- [x] The queue item lists the changelog operations in order. ("list the changelog operations in order on the queue item")
- [x] During judging, approving an update to a contest entry answers `409` and the item stays queued; a new contest entry still approves. ("waits for the results during judging", "still lets a new contest entry approve"; T35's reject and discard: "can still be rejected or discarded during judging")

## Landed

Server code: FormamorphServer `cadbe1a` "Hold Side Edits For Review". Full server suite 2299 passed, 2 skipped, in 27 s. `tests/sideEdits.test.js`: 21 tests.

Also built, by spec-session ruling: a held changelog edit answers the approved entry plus `has_pending_update` and `pending_update` (the held entry with `pending: true` when only a held create made it), and a held delete answers the pending fields. Approval applies each part with its live route's side effects: `revision` and `updated_at` rise only for fields, content, a thumbnail or a dependency change.

**Not verified**

- Approval's claim and side writes share one transaction, but no test forces a failure halfway to prove the rollback.

**For you**

- Nothing a player can judge yet: the client surfaces come with tickets 08 and 09.
- Seen, not built: three back-to-back suite runs leave about 11,000 sockets in `TIME_WAIT` and exhaust the 16,384 ephemeral ports, so the next run fails with `connect EADDRINUSE`. The ports drain in about two minutes.
