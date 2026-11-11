# 31: Morphie Reads Routines In A World

Status: ready-for-agent
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

- [ ] An entity page for a Unique entity with two Starts and three rows states the kind, both Starts with their chance, each row with its time, action and places, and Can Also Go.
- [ ] An entity page for a Generic entity states each Start.
- [ ] A location page states Travel, Distance and hints for a two-way Nearby, a one-way and a Far Connection.
- [ ] A location page lists who can be there with the reasons, equal to the Presence tab's rows for that location.
- [ ] No page shows a location id, a raw placeholder token or a field name.
- [ ] The landing gives the page of one entity and one location from the dev fixture, before and after, with the size of each.
- [ ] The in-game view is unchanged, with a test that a routine does not appear in it.

For you: in the World Editor, ask Morphie where an entity goes at night and which links of a location are Far, and say whether the answers are right.
