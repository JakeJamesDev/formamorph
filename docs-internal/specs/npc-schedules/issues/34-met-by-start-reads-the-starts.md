# 34: Met By Start Reads The Starts

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A player has already met an entity at the start of a game when that entity's Known In picks cover a location where the played persona can start. The wiki says "a location where the persona can start". The check reads the persona's derived location list, which also holds every place a routine row names. So a persona that begins at the Inn and patrols the Square has "met" an entity known only in the Square. Left by ticket 33, which fixed the same read for the New Game start list.

Make the check read the persona's Start places, with the helper ticket 33 added for the start list. Share that one helper; do not write a second.

- A persona with a kind: the place of each of its Starts.
- A Start at Player's Starting Location stands for the world's starting locations, as on the canvas (Q190). The persona can start at any of them, so a pick that covers one counts.
- A persona with no kind, and the Custom Persona, keep today's read.
- Each pick still covers its subtree, and a relationship still counts, as today.

Before the first edit, check the second point against what New Game does for such a persona. If the persona cannot start at a world starting location, ask the spec session.

Then search for any other reader of a played persona's derived locations and name each in the landing.

The wiki sentence is already right. No world or save shape changes.

Spec rulings: Q230, Q229, Q190.

## Acceptance criteria

- [x] A persona with a Start at one location and a row at a second has not met an entity whose Known In picks only the second. The test fails with the old read. (`presence.test.ts`: "does not meet through a place only a routine row names")
- [x] The same persona has met an entity whose Known In picks its Start place, and one that picks the parent of its Start place. ("meets through a Start place and through its parent")
- [x] A persona whose only Start is Player's Starting Location has met an entity whose Known In picks a world starting location. (flagged and unflagged world tests)
- [x] A persona with no kind gives the same result as before this ticket. ("keeps the own locations of a persona with no kind")
- [x] One helper gives the Start places to both the start list and this check. (`startPlaces` in `personaPick.ts`)
- [x] The landing lists every other reader checked and what each reads. (below)

## Landed

**Not verified**
- Nothing open.

**Readers checked**
- `startsMet` in `src/lib/presence.ts`: now reads `startPlaces`, plus `startingLocationIds` for a Start at Player's Starting Location. Every caller (`metCheck`, `computePresence`, stranger labels, `chainedWorld.ts`, `GameViewer.tsx`, `openingState.ts`, `statCodeTraits.ts`, `authoredScene.ts`) goes through it.
- A search for `persona.locations`, `player.locations` and similar found no other reader of a played persona's derived locations in `src`.

**Finding for you**
- In a world with no flagged starting location, New Game lists nothing for a persona whose only Start is Player's Starting Location, and `personaStartLocation` gives null. The engine starts such a game at any location (Q191). The met check now follows the engine. The start list is unchanged, as the spec session ruled.
