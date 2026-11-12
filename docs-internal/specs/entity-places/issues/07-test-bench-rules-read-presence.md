# 07: Test Bench Rules Read Presence

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The three Test Bench rules that ask where an entity can be ask the Entity Places module for Presence. A finding then always matches what the Presence tab and the canvas show.

Rules that move: "placed in no location", the orphan rule for a place that no longer exists, and "location has no entities".

Already corrected (Q9 note):

- **"Location has no entities" (#10).** NPC Schedules fixed this at f58e9c64e: with no location flagged, an entity that begins at Player's Starting Location counts at every location. This ticket keeps that behavior and gets it from Presence. It is not a new fix and needs no changelog line.

The special case for Player's Starting Location that two rules carry today goes: Presence already expands it. The helper that exists only for that special case goes with it.

Presence leaves out a row place with no path from its Start (Q8). The Test Bench must still tell the author about such a row. Check whether a finding for it exists today. If it does, keep it and prove it still fires. If it does not, add one, with copy written from the Writing Guide.

The orphan rule's fix keeps using the editor's own "remove this place from the routine" operation. It must not write the stored list for an entity with a kind.

Add the rules to the agreement test where they expose a place set. The Test Bench wiki page changes if a rule's meaning changes.

Spec rulings: Q7, Q8, Q9 (#10). ADR-0005.

## Acceptance criteria

- [x] With no location flagged as starting, a location whose only entity begins at Player's Starting Location gets no "no entities" finding, as today. The existing test passes unchanged. (rules.test: 'counts every location as occupied…'; unchanged)
- [x] With one location flagged, only that location counts as occupied by that entity. (rules.test: 'counts only the flagged location…')
- [x] "Placed in no location" gives the same findings as before on the bundled worlds and on the rule's existing tests. (existing entity-nowhere tests pass unchanged; bundled-world tests green)
- [x] The orphan rule still reports a Start, a row and a Can Also Go entry that name a missing location, and its fix removes each. After the fix the entity with a kind stores no rewritten list. (rules.test: three cases plus 'writes no list for an entity with a kind')
- [x] A row place with no path from its Start produces a Test Bench finding. The landing says whether the finding existed or was added. (rules.test and agreement test: entity-row-unreachable)
- [x] No rule special-cases Player's Starting Location outside the module, and the helper for it is gone. (beginsWithPlayer deleted; grep finds none)
- [ ] The Test Bench wiki page matches.
- [ ] A changelog fragment records the new finding if one was added. With none added, there is no fragment.

Spec rulings added after this ticket was written: Q19 (the orphan rule reads the module's named places, since Presence holds only places the world has), Q18, Q22.

## Landed

**Finding for an unreachable row place:** none existed, so `entity-row-unreachable` is new (warning, Entities). No fix. Under Q25 it gets no changelog fragment, because kinds are unreleased. Fold the line into the entity kinds entry at close.

**Not verified**
- The Test Bench wiki page: it lists no individual rule, so I changed nothing.
- Guard-bite proofs: I did not reinstate the old reads one by one.

**For you**
- `location-no-entities` now ignores the Custom Persona entity entirely. Before, a persona with an explicit location marked it occupied. The persona is the player, so I judged this right. Say so if you want the old count back.
- `entity-nowhere` also stays quiet for an entity that names a missing place; the orphan rule reports it.
- A kinded entity with only a Start at Player's Starting Location in a world with no locations is now flagged "nowhere".
- `dropRoutinePlace` is new in `entityKind.ts`: the orphan fix drops a place without rebuilding the stored list. `withoutRoutinePlace` calls it.
- `presence.ts` (stranger-face check) now reads `startPlacesOf`; its result is unchanged.
