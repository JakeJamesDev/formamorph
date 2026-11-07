# 05: Walkable Reach Cleanups

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: four refactors with no behavior change, each covered by tests that exist.

## What to build

The walkable-reach code says what it holds and keeps each rule in one place (R3). Nothing the player or author sees changes, apart from the Test Bench row reading the same as today from a new field.

- The multi-hop and narrated-moves turn tests share one helper for the scripted endpoint, the setup and the play-one-turn step, in the shared test helpers. The stop-generating wait the multi-hop copy added is kept.
- Test Bench destination rows carry a far place's route in its own field, apart from a Connection's travel hint. The row reads the same as today.
- The help text that says how far a move reaches is built from the move cap. Human docs keep the number as text.
- The walkable-reach function takes no cap parameter. The test that used it builds its case on the real cap.

## Acceptance criteria

- [x] Both turn-test files use the shared helper, and every test in them still passes. (`src/test/moveTurns.tsx`; prepare's gates run both files.)
- [x] A Test Bench row for a far place and one for a Connection read as before, in the Test Bench tests. (`aiContext.test.ts`: `route` for the far place, `hint` for the Connection.)
- [x] The help text names the cap through the constant. (`promptVariables.ts`, `${WALK_MOVE_CAP}`.)
- [x] The walkable-reach function has no cap parameter, and its tests still cover the cap. (`locationGraph.test.ts`: "stops at the move cap".)

## Landed

**Not verified**
- The rendered text of a Test Bench row: `AiContextInstrument` has no component test, so "reads as before" rests on the data fields and the unchanged join (`, then `).

**For you**
- Open the Test Bench Destinations list on a world with a far place: the row should read `via Yard, then Town` as before.
