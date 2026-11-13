# 02: Routine Gates in Play

Status: ready-for-agent
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
- No Routine holds: the entity has no Position (04 gives it the Away reader behavior, Q24).
- A Routine with no Starts never applies (Q19).
- Presence lists every Routine's places, each reason naming its Routine. Sample Placement uses the first Routine whose gate holds at the authored start (Q18).
- World Option Conditions: if world-options ticket 04 has landed, wire Option values into the Routine gate input; else leave a note for it.
- Glossary: Start, Presence and Sample Placement updated. Docs: the wiki's entity Routine page. Changelog fragment.
- ⚠️ Export-shape change for saves. A v3.7.0 save's `startId` loads as the first Routine's roll.

Spec rulings: Q3, Q4, Q5, Q7, Q9, Q11, Q12, Q13, Q18, Q19, Q24.

## Acceptance criteria

- [ ] Resolver tests: each Condition kind picks a Routine; first in order wins on overlap; blank owner reads the entity; none holding gives none.
- [ ] Engine tests: every Routine rolls once at new game; repeated swaps reuse the kept roll; a return places by Schedule at the current time.
- [ ] `computeTurnCommit` tests: a follower inside the new reach stays, one outside parts ways; the guard bites when the reach check is removed.
- [ ] Opening test: an entity whose Routine reads a setup pick opens on that Routine.
- [ ] Save tests: a save keeps every roll across save and load; a v3.7.0 save loads with its Start kept.
- [ ] Presence and Sample Placement tests for a two-Routine entity.
