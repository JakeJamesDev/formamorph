# 02: Position Engine

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Owns the types every later ticket builds on (kind, Start, schedule row, Traversable, the saved per-Individual state) and the Connected and Allowed helpers.

## What to build

One pure module that answers where every Individual is now. It takes the world, the saved per-Individual state, the clock and a random source, and returns the new positions and state. Nothing in the app calls it yet; ticket 03 wires it in. This ticket is done when its tests describe the whole behavior.

The module owns:

- The weighted Start roll, once per playthrough.
- Row resolution: the timed row covering now beats the All-day row; with no row the character stays at its Start's place.
- Stay, Wander (weighted pick among connected places, a new pick when the idle runs out) and Patrol (stops in order, idle at each, loop; resume at the stop after the last one reached).
- No move for a character at the player's location until the player leaves.
- Off-row correction, with the pull hold and the script-move hold.
- Follow states: Not following, Following, Waiting with a place and an until-time, back to Not following on timeout or Part ways. Starting a follow needs a non-Strict row; a running follow ignores Strict.
- The blocked follower: it stays and waits until the end of this daypart.
- Runtime characters: one Start at the discovery place, an empty schedule, Traversable = Anywhere.
- **Connected:** a place travel can reach from a Start's place through any path, Far links included. A listed place that is not connected is skipped in play.
- **Allowed:** the places the current row uses plus the Traversable places.

Spec rulings: Q3, Q8, Q14, Q15, Q33, Q36, Q40–Q43, Q52–Q54, Q56, Q62–Q65. The spec's "Position engine" and "Reach" sections are the contract. Types follow "World shape: entities" and "Save shape".

## Acceptance criteria

- [x] The module is pure: the same world, state, clock and seeded random source give the same result. "gives the same result for the same seed"; no clock or `Math.random` inside `src/lib/positionEngine.ts`.
- [x] Tests drive the public entry with fixture worlds and clocks, and cover: the weighted Start roll, row precedence, a gap at the Start, a range that wraps midnight, Wander picks and idle, Patrol order, loop and resume, no moves at the player's location, off-row correction, the pull hold on Stay and on Wander or Patrol, the script-move hold, the wait cap, the wait timeout, Part ways, the blocked follower, Strict on a new follow and on a running one, a skipped unreachable place, and a runtime character. One `describe` per area in `src/lib/positionEngine.test.ts`, 41 tests through `advancePositions` and the event functions.
- [x] Connected reaches through a Far link. Allowed returns every place for Anywhere and only row places for an empty list. "connects through a Far link…" and "allows every place for Anywhere…".
- [x] Each guard is proven by reinstating its bug. 34 mutations of the engine, each turned a named test red.
- [x] The test file's own duration is stated in the landing. 41 tests in 29 ms (vitest run 220 ms).
- [x] `CONTEXT.md` defines Group, Individual, Start, Schedule, Stay, Wander, Patrol, Strict and Traversable as working terms. Read in the diff.

## Landed

**Not verified**

- None.

**For you**

- "Group" now names two things in `CONTEXT.md`: the canvas frame of a parent location and the entity kind (entered as "Group (entity kind)"). The final label is yours.
- On entering a Wander row, a character already at one of its places stays and idles there instead of picking at once. That keeps a new game's character at its Start. Say if a row entry should always pick.
- A narration pull on a Stay row replaces a script hold that never ends (Q90). Say if a script hold should survive a pull.
- The Far test fixture adds `distance: 'far'` through a local type, because ticket 01 owns the field. It confirms Connected ignores distance.
