# 26: Test Bench Rules Read The Routine

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Three Test Bench rules read an entity's derived `locations` list. For an entity with a kind, that list comes from its Starts and rows, so the rules give wrong findings and one fix undoes itself. Found by the scripts sweep of 2026-11-11.

- **"Placed in no location".** The rule fires on a Unique entity whose only Start is Player's Starting Location. That is the normal companion (Q147, Q148, Q165). Such an entity is placed: the rule must not fire on it. It still fires on an entity with a kind and no Start at all, and on an entity with no kind and no location.
- **The orphan rule.** It checks and rewrites `locations`. For an entity with a kind, a Start, a row or a Can Also Go entry can name a location that no longer exists, and the rule never reports it. Report each such entity, and make the fix remove the place from the routine with the same operation the editor uses when a location is deleted. The derived list then follows. An entity with no kind keeps today's check and fix.
- **"Location has no entities".** A place that only a Player's Starting Location Start can reach reads as empty. A world starting location counts as occupied by an entity that begins at Player's Starting Location.

First check whether deleting a location in the editor already removes it from every routine. If it does, the orphan case arises only through import or hand edits; say so in the landing.

The Test Bench wiki page does not state how the bench places entities: at the opening hour, a Unique entity from its first Start and a Generic entity from all of its Starts. Add that rule where the page describes the AI Context and the Opening.

Do not rebuild the help vectors. Ticket 32 does that once.

Spec rulings: Q208, Q147, Q148, Q165, Q55.

## Acceptance criteria

- [ ] A Unique entity whose only Start is Player's Starting Location gets no "placed in no location" finding. The test fails with the old check.
- [ ] A Unique entity with no Start, and an entity with no kind and no location, still get the finding.
- [ ] A Start, a row and a Can Also Go entry that name a missing location are each reported, and the fix removes each. A second run of the rule finds nothing.
- [ ] The orphan fix on an entity with a kind leaves `locations` equal to what the routine derives.
- [ ] A starting location whose only entity begins at Player's Starting Location gets no "no entities" finding.
- [ ] The Test Bench wiki page states the placement rule.
- [ ] The landing says whether the editor's location delete already cleans routines, with the evidence.
