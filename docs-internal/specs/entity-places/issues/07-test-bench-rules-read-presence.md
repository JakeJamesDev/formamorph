# 07: Test Bench Rules Read Presence

Status: ready-for-agent
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

- [ ] With no location flagged as starting, a location whose only entity begins at Player's Starting Location gets no "no entities" finding, as today. The existing test passes unchanged.
- [ ] With one location flagged, only that location counts as occupied by that entity.
- [ ] "Placed in no location" gives the same findings as before on the bundled worlds and on the rule's existing tests.
- [ ] The orphan rule still reports a Start, a row and a Can Also Go entry that name a missing location, and its fix removes each. After the fix the entity with a kind stores no rewritten list.
- [ ] A row place with no path from its Start produces a Test Bench finding. The landing says whether the finding existed or was added.
- [ ] No rule special-cases Player's Starting Location outside the module, and the helper for it is gone.
- [ ] The Test Bench wiki page matches.
- [ ] A changelog fragment records the new finding if one was added. With none added, there is no fragment.

Spec rulings added after this ticket was written: Q19 (the orphan rule reads the module's named places, since Presence holds only places the world has), Q18, Q22.
