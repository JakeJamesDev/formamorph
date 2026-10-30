# 01: Presence Module

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Build the one module that says, for every entity, **where** it is (here, connected or elsewhere), whether the player has **met** it, whether it is **in scene**, and the **label** a player sees. It exposes the three named sets the spec defines: **Look Around**, **In Scene** and **Met**. Surfaces do not change in this ticket. They move onto the sets in tickets 02 to 08.

This ticket also owns the shared pieces the later tickets import:
- The optional `strangerName` and `strangerDescription` entity fields: the type and world load only, since the editor is ticket 06. Both resolve through placeholders and rolls.
- The save's remembered last alias per entity, filled from the planner's cast alias.
- A move clears the live scene list, followers kept.
- Met-in-play detection on naming, dialogue included, which replaces today's single effect over the live scene list. The start-met rule is derived at read time and never stored.

## Acceptance criteria

- [x] Mara quiet for 2 turns is In Scene. After 3 quiet turns she is not. (`presence.test.ts` "keeps Mara in scene for 2 quiet turns and drops her after 3"; `recentSceneTurns` counts turns with no participants.)
- [x] A move clears In Scene except for followers. An entity the story moves away leaves In Scene at once. ("clears the scene on a move except for followers", "drops Mara at once…", `sceneAfterMove` for the live scene list.)
- [x] A name only inside another character's dialogue does not put that entity In Scene, but it does make a stranger met. ("keeps Bram out of scene when only Mara's dialogue names him, but meets him", through `readNarration`.)
- [x] Connected covers parent, sibling and child places and map connections. An unpositioned entity is here at every place it lists. (`where` describe block.)
- [x] Start-met: no Stranger Name means met. A relationship on either side with the played persona means met. An explicit Known In pick whose subtree covers a place the persona's entity lists means met. The Nearby default and Nowhere do not. A runtime character starts met. A persona with no places meets strangers fresh. (`start-met` describe block; Q48 authored blank in `resolveWorldNames.test.ts`.)
- [x] Labels: a met entity shows its resolved name. A stranger shows its latest remembered alias, else its resolved Stranger Name. With neither it has no label and is absent from Look Around and In Scene. (`labels` describe block.)
- [x] An older save with an empty met list reads every entity without a Stranger Name as met. ("reads an older save with an empty met list…")
- [x] Each rule's test fails when its old behavior is put back. (15 mutants of `presence.ts` plus the Q48 blank guard, each red; see Not verified for the GameViewer wiring.)
- [x] The changelog fragment and the glossary entries for Look Around, In Scene, Met and Stranger are written. The landing message lists both export-shape changes.

## Landed

**Not verified**
- The GameViewer wiring is checked by typecheck and review only, not by a test or a live run: met-on-naming at the turn commit and on a latest-page edit, the alias write from the planner cast, and the move clearing the live scene list.

**For you**
- Walk to another place on the map with a follower. The Entities tab should list only the follower until the next narration.
