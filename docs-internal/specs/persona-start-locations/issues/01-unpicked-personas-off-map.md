# 01: Unpicked Personas Stay Off The Map And Out Of Known In

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

A Persona-Only entity that the player did not pick never holds a Position and never appears through Known In. Today the positioned cast keeps it, so its routine gives it a Position, and the Known In lookup can list it. It is never in the cast (`inCast`), so neither should happen.

- Reproduce first: a world with a Persona-Only entity placed at the player's starting location and a Known In pick there, played under another persona. Read the turn's request body and the map positions on today's code, and record what leaks.
- The positioned cast drops an entity with the Persona and Persona-Only marks unless it is the played persona, as it already drops the Custom Persona.
- The Known In lookup drops the same entities.
- The played Persona-Only entity is unchanged: it is the player.
- Changelog fragment in `docs-internal/changelog.d/` only if the leak reached anything a player sees.

Spec rulings: Q6.

## Acceptance criteria

- [x] A game turn test, red on today's code, shows that an unpicked Persona-Only entity placed away from the player with a Known In pick at the player's location holds no Position: gameplay `entityPositions` never names it (`GameViewer.unpickedPersona.test.tsx`; red before the fix, `["bram","cassia","ghost"]`). Rewritten with the spec session: the request body never leaked.
- [x] The same turn's request body never names the entity, while a cast control with the same Known In pick is named. A guard, green on today's code too.
- [x] A `knownEntityIds` unit test with a persona ref drops an unpicked Persona-Only entity and the played persona of any role (`locationContext.test.ts`); `positionedCast` drops the same (`entityPresence.test.ts`).
- [x] The guard bites: reinstating the old positioned cast and the unfiltered Known In lookup turned all three tests red.
- [x] Played as that Persona-Only entity, the player still starts and moves as before; an existing persona play test stays green (`GameViewer.actionList.test.tsx`, `GameViewer.personaSwitchScript.test.tsx`, `persona.test.ts`: 192 tests green).
- [x] The ticket records what the reproduction found leaking on today's code (Landed section).

## Landed

**Reproduction on today's code** (mounted GameViewer turn, unpicked Persona-Only entity at the inn, Known In harbor, another persona played):
- Leaked: the entity held a Position. `GameViewer.tsx` positions the raw world at opening, so `entityPositions` was `["bram","cassia","ghost"]`.
- Did not leak: the narrator request. `resolvePersona` already applies `inCast` to the live cast.
- Leaked to raw-entity callers: `knownEntityIds` through the chip scene and Test Bench. The roster and pulled ids now follow `inCast` (Q8).
- Left alone by ruling: the World Editor's Known Here list (`knownHere`).
- No changelog fragment: nothing a player sees changed.

**Not verified**: none.

**For you**: nothing only a player can judge.
