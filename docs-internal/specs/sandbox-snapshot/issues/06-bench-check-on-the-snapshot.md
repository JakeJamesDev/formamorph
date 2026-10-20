# 06: The Bench Check on the Snapshot

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

The Test Bench's script check becomes the third caller, adopts Test Code's three turn-one readings, and the module's two cross-caller guards land. Rulings Q2, Q4, Q9, Q11 (the Bench's enumeration).

## What to build

An author opens the Bench's Issues and the script check shows what a real turn one would do. A `clock.elapsedHours` branch reads the turn's clock, a write to a switched-off stat is dropped, and a `diary` name no entity has is a warning rather than a failure. Behind it, the check takes the authored world at turn one from the opening fold, enumerates its units through the snapshot's Owner derivation, runs each through `snapshot.run`, and maps a failing result and unknown write names to its existing finding kinds.

## Acceptance criteria

- [ ] The check builds its state through `openingStateOf` and its snapshot through `snapshotOf` with no overlays, and runs each unit through `run`. Its own seeding, entry building and unit-to-owner mapping are deleted.
- [ ] The clock comes from the Timing as Test Code's does, the enabled map is the authored one, and the cast is open.
- [ ] Finding kinds and message shapes for a failing Script and for unknown write names are unchanged.
- [ ] A parity test builds one fixture world and asserts that the Bench's snapshot and Test Code's snapshot assemble identical options for the same unit.
- [ ] A source-walk test fails if any non-test file outside the snapshot module imports the executor. It passes.
- [ ] Existing Bench rule tests stay green. An assertion changes only where a ruling changed the result, and each such change names the ruling in the test.
- [ ] A changelog fragment with one Fixed lead for authors: Test Code and the Test Bench run a Script under the same turn-one clock, enabled map and cast as play.
- [ ] Four gates green, exit codes read.
