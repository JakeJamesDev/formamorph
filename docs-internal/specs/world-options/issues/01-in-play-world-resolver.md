# 01: In-Play World Resolver

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A prefactor. One pure In-Play World resolver takes the authored world and the playthrough state and returns the in-play view: which entities and locations are on, which locations are locked, and room for the Option pins and lock-line parts later tickets add. Today every entity and location is on and none is locked, so behavior does not change.

- Build the resolver as a deep module with a small interface. Later tickets add gates inside it; readers never learn how a gate works.
- Move the core in-play readers onto it: presence and the scene cast, routines and positions, Known In and reach, the AI context builders and chip values, the navigation graph and the router's candidate walk, and the new-game start pick.
- Add a reader-coverage parity harness: a test world plus a hook that lets a test mark one entity and one location as off in the resolver, then asserts neither appears in each covered reader's output. Ticket 02 extends it to every remaining reader.
- No changelog fragment: no player-visible change.

Spec rulings: Implementation Decisions (In-Play World resolver), Testing Decisions (reader coverage).

## Acceptance criteria

- [x] The resolver has unit tests for today's world: every entity and location on, none locked. `inPlayWorld.test.ts`, "a world with no gates" (same arrays back, none locked); 100% coverage of the resolver and gates modules.
- [x] The parity harness, with one entity and one location forced off through the resolver, shows neither in presence, positions, Known In, the AI context, chip values, the router's candidates or the start pick. `GameViewer.inPlayWorld.test.tsx`: real GameViewer, forced off with `forceOff` (`src/test/inPlayOverride.ts`); each case has an on twin as its control. Covers a runtime character and a save load too.
- [x] The guard bites: routing one covered reader back to the raw world turns its harness case red. Mutated nine readers one at a time: the router candidates, start pick, routines memo, start-book placement, presence, AI context and chips, load placement, runtime cast and runtime presence. Each turned its case red.
- [x] Existing turn pipeline parity tests stay green with no fixture changes. `src/lib/turnPipeline` suite green; no fixture touched.

## Landed

**Not verified**

- The runtime characters in GameViewer's routines memo read the in-play list, but no harness case can see it. Runtime characters' engine places are filtered out of the stored positions, so routing that one input back to the raw list stays green.

**For ticket 02 and later**

- Still on the authored world, by design for 02: `codeEntities` (scripts, owner traits), `pinsFor` (placeholder pins), the library list, `getWorldData()` readers (World Tools, Formaquestion Player View).
- The cross-world load in GameViewer resolves another world's save before that world is in play, so it passes no gate. Ticket 08 should decide whether it gates.
- Placing an off entity drops its stored position and engine state, at the next placement and at load. A re-enabled Unique is placed again by its routine. Ticket 07 (Q23 inertness) should confirm this matches intent.

**For you**

- Nothing to judge: no player-visible change.
