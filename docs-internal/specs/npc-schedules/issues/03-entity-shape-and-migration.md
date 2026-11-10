# 03: Entity Shape and Migration

Status: ready-for-human
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

- [x] `migrateWorld` maps each row of the spec's migration table, and a second run changes nothing. Tests cover each row. *(version.test.ts, "entity kind and routine" block: one case per row, plus "changes nothing on a second run".)*
- [x] The bundled worlds and the dev fixtures load through the same path with no entity left on the old fields. *(entityRoutineMigration.test.ts; the seven bundled files are stored migrated, so bundledWorlds.test.ts "is stored in the current shape" passes.)*
- [x] An Individual's `locations` equals its Start and row places after an edit and after a load. The roster indexes, the location-first roster editor and Known In "Nearby" still read it. *(version.test.ts "rebuilds an Individual's locations"; entityPicking.test.ts and EntityFields.locationsHint.test.tsx for edits; entityPresence.test.ts for the rosters.)*
- [x] A new game rolls one Start per Individual and saves it. Loading the save keeps the same Start. *(GameplayContext.positions.test.tsx "rolls one Start per Individual".)*
- [x] An Individual on a Wander row moves while the player is elsewhere, and does not move while the player is with it. Tested through the turn pipeline with a fixture clock. *(GameViewer.schedules.test.tsx, on the flat hour per turn; mutation-tested by skipping the commit step.)*
- [x] A save made before this change loads, and each Individual gets a position from the engine. *(positions test "places every Individual … when a save from before it loads": followers load as Following, a saved place keeps its Start.)*
- [x] The save round-trips the chosen Start, follow state, wait until-time, hold, idle end and patrol stop. *(positions test "round-trips the chosen Start …".)*
- [x] `.follow()`, `.unfollow()` and `.move()` behave as the spec says, and the waiting state reads true for a waiting follower. `.follow()` on a Group does nothing. *(entityFollowing.test.ts "a script's entity writes"; computeTurnCommit.test.ts "code entity writes"; `waiting` on the entry in the executor and surface tests.)*
- [ ] Deleting a location drops it everywhere the spec lists, as one undo step. *(The drop: entityPresence.test.ts dropLocationFromEntities cases.)*
- [x] No reader of `movement` or `presence` remains outside the migration. *(grep over src; typecheck drops both fields from `Entity`.)*
- [x] The Test Bench places entities for the hour it simulates. *(`openingCast` places the AI Context and chip previews at the opening hour, the hour a new game starts at; worlds author no calendar yet.)*
- [x] The stand-in control sets the kind, a Group's places and one Start place. Its copy follows the Writing Guide. *(EntityFields.locationsHint.test.tsx; panel label tests.)*
- [x] The world format doc, the script reference and the entity wiki pages describe the new shape. A changelog fragment covers the player-visible change. *(WorldFormat.md, Scripts-Reference.md, World-Editor-Entities.md, World-Editor-Locations.md, Glossary.md; changelog.d/npc-schedules-03.md.)*

For you: play a shipped world you know (the Centaur world works) for a few in-game days and check that characters are where you expect.

## Landed

**Rulings this ticket added:** Q93–Q98 (interim follower, request, peel-off, pull, picker and `.move()` rules) and Q99 (a migrated Wander idles 240 minutes).

**Not verified**

- Deleting a location as one undo step: the drop runs inside the existing location delete, which was one undo step before; no test here checks the step count with a routine in it.
- Not checked in a browser: the stand-in control's look, in either theme. Component tests cover its behavior.

**For you**

- For you: play a shipped world you know (the Centaur world works) for a few in-game days and check that characters are where you expect.
- The stand-in **Placement** control in the entity editor's Profile tab: whether **One Location** / **Every Location** and **Starts At** read clearly until ticket 04 replaces it.
- An entity that was **Free** at one location no longer comes over from the next room (Q23). Check that a world you know still calls over who you expect.

**Notes for later tickets**

- Until 09, a request's **Go to** offers only the current row's places among neighbors, not every Traversable place, so Anywhere characters get no new walk options and the prompt does not widen without probes.
- The game also places everyone at the start of each turn, so a character met since the last commit has its engine state before it is asked or pulled.
