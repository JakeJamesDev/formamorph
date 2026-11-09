# 03: Entity Shape and Migration

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The largest ticket: `movement` has about 15 readers, and they all change here.

## What to build

A world's entities carry the new shape: a Group or Individual kind, and for an Individual its Starts, schedules and Traversable list. `movement` and `presence` are gone. A shipped world opens and plays as it did before, through the migration table in the spec. An Individual's `locations` is derived from its Start and row places; the editor and the load normalizer rewrite it and nothing else writes it.

In play, the game places and moves characters through the position engine: at game start, once more when the opening hour is set, on load, and at each turn commit after time passes. Characters now move while the player is elsewhere. The save stores the engine's per-Individual state. Scripts keep working: `.follow()` on any Individual, `.unfollow()` as Part ways, `.move()` with a hold, and a read-only waiting state on the entity entry.

The old Presence and Movement controls are removed from the entity editor, the location editor and the canvas card, with their copy and the range warning. Until ticket 04 lands, a plain control stands in: the Group / Individual switch, a Group's place list, and one Start place for an Individual. A new entity is an Individual with Traversable = Anywhere.

Deleting a location drops it from Starts, rows and Traversable. A Start whose place is deleted is dropped, and a row left with no places is dropped.

Spec rulings: Q6, Q12, Q15, Q18, Q20, Q23, Q28, Q31–Q35, Q51–Q58, Q64. Stories 1–4, 8, 26–29, 36–38, 54, 55. The spec's "World shape: entities", "Migration", "Position engine" (the call sites) and "Save shape" sections are the contract.

**Export shape:** the world file loses `movement` and `presence` and gains kind, Starts, schedules and Traversable. The save file gains the engine's state. Say so in the landing.

## Acceptance criteria

- [ ] `migrateWorld` maps each row of the spec's migration table, and a second run changes nothing. Tests cover each row.
- [ ] The bundled worlds and the dev fixtures load through the same path with no entity left on the old fields.
- [ ] An Individual's `locations` equals its Start and row places after an edit and after a load. The roster indexes, the location-first roster editor and Known In "Nearby" still read it.
- [ ] A new game rolls one Start per Individual and saves it. Loading the save keeps the same Start.
- [ ] An Individual on a Wander row moves while the player is elsewhere, and does not move while the player is with it. Tested through the turn pipeline with a fixture clock.
- [ ] A save made before this change loads, and each Individual gets a position from the engine.
- [ ] The save round-trips the chosen Start, follow state, wait until-time, hold, idle end and patrol stop.
- [ ] `.follow()`, `.unfollow()` and `.move()` behave as the spec says, and the waiting state reads true for a waiting follower. `.follow()` on a Group does nothing.
- [ ] Deleting a location drops it everywhere the spec lists, as one undo step.
- [ ] No reader of `movement` or `presence` remains outside the migration.
- [ ] The Test Bench places entities for the hour it simulates.
- [ ] The stand-in control sets the kind, a Group's places and one Start place. Its copy follows the Writing Guide.
- [ ] The world format doc, the script reference and the entity wiki pages describe the new shape. A changelog fragment covers the player-visible change.

For you: play a shipped world you know (the Centaur world works) for a few in-game days and check that characters are where you expect.
