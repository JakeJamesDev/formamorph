# 33: A Playable Entity Offers Its Starts Only

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

In New Game, a player who plays as a Playable or Persona-Only entity picks where to start. The list should hold the places that entity's Starts begin at. Today it holds every place the entity's routine uses: the persona pick reads the entity's derived location list, which also has every place a row names. So an entity that begins at the Inn and patrols the Square offers the Square as a start. Found by ticket 32.

The Routine tab hint already says "Lets the player start at any start location as this entity", and the wiki now says the same (ticket 32). The user confirmed on 2026-11-11 that Starts only is the intent (Q229).

- The start list for a played entity holds the place of each of its Starts, in Start order, each once.
- A Start at Player's Starting Location adds no place of its own; the world's starting locations are already in the list.
- The preselected place keeps today's rule, applied to that list: the first one that is a starting location, else the first.
- The Custom Persona and an entity with no kind keep today's behavior.

Check every other reader of the played entity's locations in the New Game and persona path for the same fault, and name each in the landing.

No world or save shape changes.

Spec rulings: Q229, Q147.

## Acceptance criteria

- [x] A Playable entity with a Start at one location and a row that names a second offers only the first. The test fails with the old read. (`leaves a row place out of the list`; fails with the kind branch off.)
- [x] An entity with two Starts offers both; the preselect follows Start order. (`offers every Start place, each once, in world order`; list stays in world order per the spec session's ruling.)
- [x] An entity whose only Start is Player's Starting Location adds nothing beside the world's starting locations. (`adds nothing for a Start at Player's Starting Location`.)
- [x] The preselected place follows the rule above on a list where the first Start is not a starting location and the second is. (`preselects the first Start place that is a starting location, in Start order`.)
- [x] The Custom Persona's list is unchanged. (A Custom Persona has no kind and no world persona ref; `keeps the Custom Persona's and a kindless entity's own locations` covers the kindless path.)
- [x] The landing lists the other readers checked and what each reads.

## Landed

Fix: `personaPick.ts` `startPlaces` reads an entity with a kind from its Starts (each place once, none for Player's Starting Location). An entity with no kind keeps its `locations`. Both `personaStartLocation` and `offeredStartLocations` use it.

Ruling from the spec session: the start list stays in world order; "in Start order" means the preselect follows Start order.

Other readers checked:
- `EnterWorldFlow.tsx` (persona option's `startsAt`): reads `personaStartLocation`, fixed.
- `testBench/lens.ts` and `testBench/opening.ts`: read `personaStartLocation` and `offeredStartLocations`, fixed.
- `locationForPersonaPick`: reads both helpers, fixed.
- `presence.ts:97` (`metCheck`): reads `persona.locations` for the met-by-start rule through Known In. It still sees row places. Left unchanged: a different mechanic from the start list.

Not verified:
- A kinded entity with no `starts` array now offers no place; a world always writes `starts` with a kind, but no test pins it.
- No UI check of the New Game step; the change is in the pure helpers and their tests.

For you:
- Open New Game on a world with a Playable entity that patrols: the Starting Location step lists its Start places, not its row places.
