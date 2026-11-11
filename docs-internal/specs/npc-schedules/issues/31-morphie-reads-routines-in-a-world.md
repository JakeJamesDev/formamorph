# 31: Morphie Reads Routines In A World

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

In the World Editor, Morphie reads the author's world through an index of pages. An entity's page holds its Locations and Known In only. A location's page lists its Connections as bare names. So Morphie cannot answer "where does this entity go at night?" or "which links are Far?" about the author's own world. Found by the help-docs sweep of 2026-11-11.

Add to an entity's page:

- its kind, Unique or Generic;
- each Start: the place, the chance when there are several, and Follows the Player;
- each routine row: the hours or dayparts, what it does (stays, wanders, patrols), the places, and whether it is locked;
- Can Also Go: Anywhere, or the listed locations.

Add to a location's page, for each Connection: the other location, the Travel direction, the Distance, and the travel hints. Also list who can be at the location and why, from the presence-line model the Presence tab already uses.

Use the labels the screen shows, never the field names, and resolve location ids to names and placeholders to labels. Keep each page short: a routine is a few lines, not a dump of the record. The Custom Persona keeps today's page.

The in-game view already carries Connection distance; do not change it. Check that it shows a player nothing about a routine that the game hides.

Do not rebuild the help vectors. Ticket 32 does that once.

Spec rulings: Q213, Q81, Q207.

## Acceptance criteria

- [x] An entity page for a Unique entity with two Starts and three rows states the kind, both Starts with their chance, each row with its time, action and places, and Can Also Go. (worldIndex.test.ts, "states a Unique entity's kind…")
- [x] An entity page for a Generic entity states each Start. (test "states each Start of a Generic entity…")
- [x] A location page states Travel, Distance and hints for a two-way Nearby, a one-way and a Far Connection. (test "states Travel, Distance and hints…")
- [x] A location page lists who can be there with the reasons, equal to the Presence tab's rows for that location. (test compares with `presenceLines`)
- [x] No page shows a location id, a raw placeholder token or a field name. (test "shows no location id, token or field name", four pages)
- [x] The landing gives the page of one entity and one location from the dev fixture, before and after, with the size of each. (below)
- [x] The in-game view is unchanged, with a test that a routine does not appear in it. (test "keeps the in-game view free of routines"; `playerViewWorld.ts` is not edited)

For you: in the World Editor, ask Morphie where an entity goes at night and which links of a location are Far, and say whether the answers are right.

## Landed

Sizes, from the bundled Emberwatch world (the dev fixture holds no routines). Before = the page with kind, Starts, Can Also Go and Connections removed.

- Entity Sylvie Thornwhistle: 849 → 1070 chars. It gains Unique, one Start with two rows, and Can Also Go.
- Location Emberwatch Keep: 846 → 1961 chars. It gains four Connections with hints and three Entities Here lines. The old page held a one-line list of names (about 100 chars more than the 846).

**Not verified**
- Morphie's answers in the live World Editor: no model call was run.
- The Persona page staying unchanged: no new test; an entity with no kind skips every new line by construction.
- Wander weights and Patrol idle times are left out on purpose, to keep a routine to a few lines.

**For you**
- In the World Editor, ask Morphie where an entity goes at night and which links of a location are Far, and say whether the answers are right.
