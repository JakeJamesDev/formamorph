# 02: The Opening Fold as a Pure Function

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The state a new game opens with, built in one pure function and used by Enter World and the Bench's opening instrument. Rulings Q3, Q12.

## What to build

A player enters a world and the game opens exactly as before: the same stats, held picks, global rows, owned traits, entity stats and clock. Behind it, `openingStateOf(world, picks, persona)` returns the `SandboxState` of turn one. The Enter World effect calls it and keeps only its setters. The Test Bench's opening instrument calls it instead of its own copy of the fold. An editor caller can pass no picks, no persona and an empty roll set and get the authored world at turn one.

## Acceptance criteria

- [ ] `openingStateOf(world, picks, persona)` is a pure lib function with no React import. It returns a `SandboxState`.
- [ ] It seeds global stats by play's rule, acquires the held picks in order, applies global rows and owned traits, seeds each entity's own stats, sets the opening clock and holds no rolls.
- [ ] The Enter World effect in the game view calls it and only writes the result into Gameplay state. The inline fold is gone.
- [ ] The Test Bench's opening instrument calls it. Its own seeding and settling helpers are gone.
- [ ] A test builds a fixture world with picks and a persona and asserts the returned stats, traits, entity stats and clock match what the effect produced before. A second case passes no picks, no persona and an empty roll set.
- [ ] The parity fixtures stay byte-equal. The opening-turn view tests and the Bench opening instrument tests stay green with no assertion change.
- [ ] Four gates green, exit codes read.
