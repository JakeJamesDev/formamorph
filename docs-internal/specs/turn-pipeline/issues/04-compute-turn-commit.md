# 04 — Compute The Turn Commit

**What to build:** The pure commit computation of the Turn Pipeline: from a finished runner result, build the Turn Commit — the complete state delta a turn applies: history entries, the turn clock, stat changes, and discoveries made this turn. The view's apply step becomes a thin block of setters over this value; the merge logic itself becomes testable data-in, data-out.

**Blocked by:** 03 — The Runner: Scheduler, Typed Errors, Narration Forwarding.

Status: done

- [x] Commit computation is pure and returns the full delta as one value — `src/lib/turnPipeline/computeTurnCommit.ts` (`computeTurnCommit`); the one impure step, the discovered entity's id, is an injected `newEntityId` defaulting to `randomUUID`
- [x] History, clock construction, stat application inputs, and discovered-entity materialization all covered by unit tests — `computeTurnCommit.test.ts` (26), 100% statements/branches/lines
- [x] Aborted and failed results produce the correct (empty or partial-per-today's-behavior) commit — aborted, failed and empty-narration all answer `null` (nothing applied, exactly as the view's three early returns do today); a *batched* pass failure still commits, minus that pass's field, which is today's absorbed-failure behavior
- [x] Key guards mutation-proven — 14 mutations run, 13 caught by the test that names them. The one that isn't: `locationId` is spread on `!== undefined` rather than on truthiness, which only differs for an empty-string location id — unreachable (ids are UUIDs), so it is written to match today's `locationId: turnLocation?.id` and left untested rather than given an invented scenario.
- [x] Four gates green — typecheck 0, lint 0, test 4262 passed / 3 skipped in 25.27s, build ✓

## Notes for ticket 05

- **`computeTurnCommit` returns `TurnCommit | null`.** Null means "apply nothing" — it does not distinguish stopped from failed, because neither applies anything. The view still needs the run's `status`/`kind` for its toasts and for `discardUnpairedUserTurn`, so 05 branches on the result *and* calls this.
- **Two things the commit deliberately does not own,** because today's flow applies them earlier than the commit point: the auto-resolved location move (applied right after the narration, so an aborted turn leaves it unchanged) and `setChoicesReady`. Both stay view-side.
- **`context.locationId` vs `context.discoveryLocationId`** are the view's `turnLocation?.id` and `turnLocation?.id ?? currentLocation?.id`. They differ only in a world with no location on the turn; kept as two fields rather than one so neither call site guesses.
- **`turn` is the stored `AITurnResult` object, not a string.** The view stringifies it into the assistant message. Its key order matches today's literal, so the stored JSON is byte-identical for the same turn.
- **`materializeDiscoveredEntity` gained an optional third `id` argument** so the commit stays pure — the new entity's id is the one value that isn't a function of the inputs, so it enters as one (`context.newEntityId`, defaulting to `randomUUID`). Existing callers are unchanged.
- **`suggestedLocation` is already filtered against staying put.** The view's guard is `target.id !== currentLocation?.id` (`GameViewer.tsx:2103`); the commit reproduces it by name via `context.currentLocationName`, since the router only ever answers with a destination name. 05 still resolves the name to a `GameLocation` before offering it.

## Found in review

- **The stay-put guard was missing** and is now in (above). Without it, a router reply naming the current location would have produced a move offer where today it produces none.
- **A within-turn discovery dedupe had crept in** — the first draft also filtered new discoveries against the rest of the same batch. Today's filter runs against already-known names only, so two variant spellings in one turn both materialize. Reverted to today's behavior and pinned by a test; worth revisiting as a behavior change of its own, not under a parity ticket.
