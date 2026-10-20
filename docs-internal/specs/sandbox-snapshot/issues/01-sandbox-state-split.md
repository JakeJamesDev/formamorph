# 01: SandboxState Split

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A prefactor with no behavior change. The turn input's world fields become one named type, so the snapshot (03) and the opening fold (02) have a shape to return and to read. Rulings Q13.

## What to build

A player's turn runs exactly as before. Inside, the turn input holds a `SandboxState` as one field: the global stats and their enabled map, the Owners and their stats, the traits in force (held, applied values, disabled ids, cascade-off ids, owned traits, the trait world and library), the placeholders with their rolls and pins, the places and current location, the discovered cast, and the clock. The per-turn parts (timing, triggers, replayed writes, narration, switched trait, prompts, previous values, asks, regen applied) stay beside it. The view's turn assembly builds the state as one value and hands it over.

## Acceptance criteria

- [ ] A `SandboxState` type names the world fields listed above, with TSDoc prose for each field.
- [ ] The turn input holds one `state: SandboxState` field. The world fields no longer sit flat on the turn input.
- [ ] The view's turn assembly builds the state once per turn and the turn module reads only through it.
- [ ] Every caller of the turn module (play, World Tool turns, the re-roll) compiles with no `any` and no cast.
- [ ] The parity fixtures stay byte-equal. Every existing turn and view test stays green with no assertion change.
- [ ] Four gates green, exit codes read.
