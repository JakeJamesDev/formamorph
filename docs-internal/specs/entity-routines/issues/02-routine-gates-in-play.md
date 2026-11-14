# 02: Routine Gates in Play

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: engine state, save shape and the turn commit change together. Follow and opening edge cases need care.

## What to build

A character switches behavior when the world changes: the first Routine whose gate holds applies, on the Start it rolled for that Routine at new game.

- The in-play resolver evaluates Routine gates in the same pass as Enabled gates, against committed state, and returns the applying Routine per entity. A blank owner reads the entity. First in author order wins (Q3, Q7, Q9).
- At new game, every Routine of a Unique entity rolls one Start by weight. The save keeps the applying Routine and one roll per Routine. A swap reuses the kept roll and never rolls again (Q4).
- A swap places the entity by the new Routine's Schedule at the current time, with no hold, idle or patrol stop carried over (Q11). A Generic entity's instances of an off Routine leave and return the same way (Q5).
- A follower stays when the player's place is inside the new Routine's reach, and otherwise parts ways through the dismissal path (Q4, Q13).
- The opening placement reads Routine gates against the state after setup picks (Q12).
- No Routine holds: the entity is Away (Q24), through ticket 04's `awayAllDay(routine)` engine helper (Q29). Add the reader-parity harness case for it (04 left it to 02).
- A script move on an All-day Away row holds until another script move. Check that such a hold does not pin an entity whose applying Routine changes.
- A Routine with no Starts never applies (Q19).
- Presence lists every Routine's places, each reason naming its Routine. Sample Placement uses the first Routine whose gate holds at the authored start (Q18).
- Ticket 01 added `applyingRoutine(entity)` as the one seam; replace its body with the gate pick. Rename the engine's flat `Routine` view type in the position engine so it no longer clashes with the glossary word.
- World Option Conditions: if world-options ticket 04 has landed, wire Option values into the Routine gate input; else leave a note for it.
- Glossary: Start, Presence and Sample Placement updated. Docs: the wiki's entity Routine page. Changelog fragment.
- ⚠️ Export-shape change for saves. A v3.7.0 save's `startId` loads as the first Routine's roll.

Spec rulings: Q3, Q4, Q5, Q7, Q9, Q11, Q12, Q13, Q18, Q19, Q24.

## Acceptance criteria

- [x] Resolver tests: each Condition kind picks a Routine; first in order wins on overlap; blank owner reads the entity; none holding gives none. `inPlayGates.routines.test.ts`, all seven kinds, World Option included.
- [x] Engine tests: every Routine rolls once at new game; repeated swaps reuse the kept roll; a return places by Schedule at the current time. `positionEngine.test.ts` › Routines (10 cases, an Away hold that does not pin a return included).
- [x] `computeTurnCommit` tests: a follower inside the new reach stays, one outside parts ways; the guard bites when the reach check is removed. `computeTurnCommit.test.ts` › a follower whose Routine swaps; `followAfterSwap` mutated to keep every follow, 3 cases went red.
- [x] Opening test: an entity whose Routine reads a setup pick opens on that Routine. `GameViewer.routineGates.test.tsx` › the opening placement; the ungated opening pick turns it red.
- [x] Save tests: a save keeps every roll across save and load; a v3.7.0 save loads with its Start kept. `GameplayContext.positions.test.tsx` › an entity with Routines; the load hold for gated Unique and Generic entities each reverted once and went red.
- [x] Presence and Sample Placement tests for a two-Routine entity. `entityPlaces.test.ts` and `locationPresenceReasons.test.ts`.

## Landed

**Not verified**
- Nothing open in the criteria. A gate flip mid-play with a follower is covered at the engine and commit seams, not by a full GameViewer turn.
- No frame: nothing new renders except the Presence reason text, checked by DOM-free tests.

**For you**
- ⚠️ Save shape: a Unique entity's engine state gains `routineId`, `rolls` and `nowhere` (written only for two or more Routines, or while none holds). A v3.7.0 save loads as before.
- Presence tab copy for a two-Routine entity reads *Day: begins here (50%)*. Approve the "Routine name: reason" form or name another.
- A swap of an entity standing at the player's location waits until the player leaves (the existing "nobody leaves mid-scene" rule). Check that this feels right in play.
- Notes for later tickets: the fallback Sample Placement for a save with no stored opening placement (`openingPlacement.ts`) stays ungated; only pre-placement saves reach it. `startsOf`/`traversableOf` now mean the first Routine explicitly, for 03's editor.
