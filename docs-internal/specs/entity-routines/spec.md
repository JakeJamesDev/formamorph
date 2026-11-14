# Spec: Entity Routines

Status: ready-for-agent
Spec session: entity-routines — spec

## Problem Statement

An entity with a kind has one fixed set of Starts. Whatever happens in the world, it rolls one Start at new game and keeps the same daily Schedule for the whole save.

- **One behavior per entity.** An author cannot give a character two ways of living that depend on the world, such as one Schedule while she is Female and another while she is Futanari, or one before a story event and another after.
- **No time off the map.** A Schedule row always puts the character somewhere. An author cannot say "from 9 PM to 6 AM she is gone": not at any place, not met, but still the same character with stats and scripts.

The first world to need this is Sunmeadow Town. Its rival's partners use the Enabled gate today (world-options ticket 07), which fits a character who exists or does not. Routines fit a character who always exists but behaves differently.

## Solution

Two additions to the Routine tab.

- **Routines.** An entity holds an ordered list of **Routines**. Each Routine has a name, a **Requires** gate (Requirement Rows, as on a trait), its own **Can Also Go**, and its own Starts. In play, the first Routine whose gate holds applies. At new game, each Routine of a Unique entity rolls its Start once, and the save keeps every roll. When the world changes and another Routine applies, the entity swaps to that Routine's rolled Start with no new roll, and its Schedule places it at the current time.
- **Away.** A new Schedule action next to Stay, Wander and Patrol. During an Away row the character is at no place. It is not on the map, in a scene, or nearby, but it still exists: its stats, regen, traits and scripts run, and contexts that need no place still list it.

An entity with one Routine and no gate works exactly as today.

## Rulings

- **Q1 Need.** Build Routines as a general feature. Sunmeadow's partners use the Enabled gate; Routines serve one entity whose own behavior changes.
- **Q2 Level.** The gate sits on a level above Starts, not on Schedule rows. Each gated level holds several Starts, so it can be a random set of its own. (The user reframed the first proposal, "Starts only", into this.)
- **Q3 Condition kinds.** Every Condition kind: trait, group, playing-as, stat, item, time, and the World Option Condition once world-options ticket 04 lands. Same editor and resolver as the Enabled gate.
- **Q4 Swap model.** At new game, each Routine of a Unique entity rolls one Start by weight. The save keeps every Routine's roll. When a different Routine applies, the entity swaps to its kept Start, without a new roll. If the swap puts the entity outside its current reach, it acts as a follower that was dismissed.
- **Q5 Generic entity.** Each Routine of a Generic entity runs all of its Starts. While a Routine does not apply, its Generic Entity Instances are gone (see Q11 for their return).
- **Q6 No Routine holds.** The entity is Away all day (Q24).
- **Q7 Blank owner.** A Condition with no owner in a Routine's gate reads the entity itself, as in the Enabled gate (world-options Q29).
- **Q8 Name.** The level is a **Routine**, the same word as the editor tab. The glossary takes Routine off Schedule's avoid list.
- **Q9 Overlap.** When several Routines' gates hold, the first in author order applies. The author sets priority by order.
- **Q10 Shape.** The flat `starts` list migrates into one Routine with no gate. One shape, one editor.
- **Q11 Return.** A Routine the entity returns to resumes from its Schedule at the current time, on its kept Start. Only the rolled Start is kept per Routine, not its engine state (hold, idle, patrol stop). Generic Entity Instances return the same way.
- **Q12 Opening.** At new game, the opening placement picks each entity's Routine from the state after setup picks, so page one already shows the right Routine.
- **Q13 Can Also Go.** Traversable is per Routine. A swap checks the new Routine's reach to decide whether a follow ends.
- **Q14 Routine name.** Each Routine has an author name, defaulting to "Routine 1", "Routine 2" and so on.
- **Q15 Scripts.** Scripts cannot read or set the Routine. They steer it through what gates read.
- **Q16 Editor.** A Routine strip sits above the Start strip on the Routine tab. Under it: the shown Routine's name, Requires and Can Also Go, then its Start strip and Schedule as today. With one Routine and no gate, the tab looks as today plus an **Add Routine** button.
- **Q17 Test Bench.** No Test Bench readout in this effort.
- **Q18 Presence and Sample Placement.** Presence lists every Routine's places, and each reason names its Routine. Sample Placement uses the first Routine whose gate holds at the authored start.
- **Q19 Empty Routine.** A Routine needs at least one Start. One with none shows an editor warning and is skipped in play.
- **Q21 Away.** The new Schedule action is **Away**.
- **Q22 Away and following.** Away acts like Strict for follows: a follow already running continues, and the entity goes Away when the follow ends. During an Away row, narration cannot call it over and it cannot start a follow.
- **Q23 What Away hides.** An Away entity stays in every context that needs no place, such as a list of known entities and where they are usually found. It leaves every context tied to a map place: the scene, here, nearby, and the map.
- **Q24 Nowhere.** "No Routine holds" and "an Away row" mean the same: Away. To make an entity inert, an author uses the Enabled gate.
- **Q28 Ticket 01 answers.** Every entity with a kind holds at least one Routine; a blank entity gets "Routine 1" with no Starts. The empty-Routine warning (Q19) shows only when the entity has two or more Routines, so a lone empty Routine reads as today (Q16). Library carry and write-back run per Routine, matched by id; the update dialog keeps its Starts and Can Also Go rows, read from the first Routine. Bundled worlds are rewritten to the Routine shape in ticket 01, since the house style and the bundled-world guard require that `migrateWorld` change nothing in them. Runtime characters store nothing new; only the engine's view gets one ungated Routine.
- **Q26 Seams.** Tests go through the gate resolver, the position engine, the turn commit with the reader-parity harness, the world migration with save load, and the Routine tab. No new seam.

## User Stories

1. As an author, I want an entity to hold several Routines, so that one character can live two different lives depending on the world.
2. As an author, I want to name each Routine, so that I can tell "Female" from "Futanari" at a glance.
3. As an author, I want each Routine to have a Requires gate, so that the world decides which Routine applies.
4. As an author, I want a Routine gate to accept every Condition kind, so that traits, stats, items, time of day and World Options can all drive behavior.
5. As an author, I want a Condition with no owner to read the entity itself, so that "her own Sex trait is Futanari" needs no owner pick.
6. As an author, I want a Condition to name another entity as owner, so that a partner's Routine can follow its trainer's state.
7. As an author, I want the first Routine whose gate holds to apply, so that I can set priority by dragging Routines into order.
8. As an author, I want a Routine with no gate to always hold, so that a last Routine works as the fallback.
9. As an author, I want each Routine to hold several weighted Starts, so that each behavior can have its own random beginnings.
10. As an author, I want each Routine to have its own Can Also Go, so that two Routines can reach different parts of the world.
11. As an author, I want my existing entities to open as one Routine with no gate, so that worlds I already made work without changes.
12. As an author, I want an entity with one Routine to look as it does today, so that the Routine level costs nothing until I need it.
13. As an author, I want an **Add Routine** button on the Routine tab, so that I can add a second behavior.
14. As an author, I want a Routine strip above the Start strip, so that I can switch between Routines the same way I switch between Starts.
15. As an author, I want to reorder, rename and delete Routines, so that I can change priority and clean up.
16. As an author, I want a warning on a Routine with no Starts, so that I know it will never apply.
17. As an author, I want the Routine gate editor to read like the Enabled gate's, so that I learn one gate editor.
18. As an author, I want an **Away** action on a Schedule row, so that a character can be off the map for some hours.
19. As an author, I want an Away row to take a time range or All day like any row, so that it fits the Schedule I know.
20. As an author, I want Presence to list every Routine's places with the Routine named, so that I see every place a character can be.
21. As an author, I want Sample Placement to use the first Routine whose gate holds at the authored start, so that previews show the likely opening.
22. As an author, I want a Generic entity's Routines to work the same way, so that a herd can appear in different places when the world changes.
23. As an author, I want a kind switch to keep every Routine, so that switching Unique and Generic loses no work.
24. As an author, I want deleting a location to drop it from every Routine, so that no Routine points at a missing place.
25. As a player, I want a character to be where her current Routine puts her on page one, so that the opening matches my setup picks.
26. As a player, I want a character to switch behavior when the world changes, so that the world reacts to what happened.
27. As a player, I want a character to come back to the same Start of a behavior she had before, so that the world feels consistent across a save.
28. As a player, I want a character who follows me to stay with me after a swap if the new behavior lets her be here, so that a follow does not break for no reason.
29. As a player, I want a follower to leave when her new behavior cannot reach my place, so that she acts as if I dismissed her.
30. As a player, I want an Away character to not show on the map, in the scene or nearby, so that "gone for the night" means gone.
31. As a player, I want an Away character who is following me to keep following, so that the schedule does not pull her out of my party.
32. As a player, I want an Away character to still appear where the game lists characters I know, so that I do not forget who exists.
33. As a player, I want an Away character's stats and scripts to keep running, so that time passes for her too.
34. As a player, I want saves to keep each character's rolled Starts, so that a loaded game behaves the same as before.
35. As a player with a save from v3.7.0, I want it to load into the new shape, so that I keep my game.
36. As the AI narrator, I want an Away character left out of every place-based context, so that I never put her in a scene she is not in.
37. As the AI narrator, I want an Away character kept in context that needs no place, so that I can still mention her.
38. As a script author, I want my scripts to change what Routine gates read (traits, stats, Options), so that I can drive a swap from a script.

## Implementation Decisions

- **World shape.** An entity with a kind holds an ordered list of Routines in place of `starts` and `traversable`. A Routine has an id, a name, optional Requirement Rows, its own Traversable, and its Starts. A Start keeps its place, weight, Schedule and Begins Following. ⚠️ Export-shape change for worlds.
- **Schedule action.** `ScheduleAction` gains an Away kind with no place. Places-of helpers return none for it. ⚠️ Part of the same world export-shape change.
- **Migration.** `migrateWorld` moves an entity's `starts` and `traversable` into one Routine with no gate. It is idempotent. The library entity file and the character-card import pass through the same migration. Persona entities that keep a Start Locations list are untouched. Runtime characters get one ungated Routine.
- **Save shape.** A Unique entity's engine state records the applying Routine and one rolled Start id per Routine. A Generic entity's instances are keyed by Routine and Start. A v3.7.0 save's single `startId` loads as the first Routine's roll. ⚠️ Save-shape change.
- **Gate evaluation.** The in-play resolver evaluates Routine gates in the same pass as Enabled gates, against committed state, and returns the applying Routine per entity beside the Enabled verdicts. A blank owner reads the entity. An off entity (Enabled) keeps its frozen verdict; Routines do not change that.
- **Roll.** At new game the engine rolls one Start for every Routine of a Unique entity and stores all rolls. A swap reads the kept roll and never rolls again.
- **Opening.** The opening placement reads the state after setup picks for Routine gates. This differs from the Enabled gate's opening read today (world-options 07 left it on the pre-seed state); this effort fixes the read for Routines only.
- **Swap.** At a turn commit where the applying Routine changes, the entity's state moves to the new Routine's kept Start with no hold, idle or patrol stop. A follower stays when the player's place is inside the new Routine's reach (its current row places plus its Can Also Go), and otherwise parts ways through the existing dismissal path. A non-follower is placed by the new Schedule at the current time, silently, as any engine move is.
- **Away.** An Away row gives the entity no Position while its engine state advances. A running follow continues through it. During the row the entity cannot be called over and cannot start a follow, as on a Strict row. "No Routine holds" places the entity Away all day. Readers that need a place already treat "no Position" as nowhere; readers that list known entities without a place keep it.
- **Presence and Sample Placement.** Presence is the union over every Routine, each reason naming the Routine. Away adds no place. Sample Placement takes the first Routine whose gate holds against the authored start (`startGateInput`), then its first Start.
- **Empty Routine.** A Routine with no Starts never applies. The editor warns under it.
- **Editor.** The Routine tab gains a Routine strip above the Start strip, using the same pressed-button pattern. The shown Routine's name, Requires (the host gate editor from world-options 07) and Can Also Go sit between the two strips. The Schedule row editor gains Away in its action menu. Routine selection follows the existing Start selection pattern.
- **Glossary.** Add **Routine** and **Away**. Update **Start**, **Schedule** (drop "routine" from its avoid list), **Traversable** (per Routine), **Presence** and **Sample Placement**.
- **Docs.** The wiki's entity Routine page and the world format page. A changelog fragment per ticket.

## Testing Decisions

- A good test drives the public seam and checks what a player or the AI would see: who is where, who follows, what each context lists. It never asserts internal state shapes beyond the save.
- **Gate resolver** (`inPlayGates` tests): each Condition kind picks a Routine; first-in-order wins on overlap; blank owner reads the entity; no Routine holds gives none.
- **Position engine** (`positionEngine` tests): every Routine rolls once at new game; a swap reuses the kept roll across many swaps; a return places by the Schedule at the current time; an Away row gives no Position while time and Patrol progress continue; a follower through an Away row keeps following.
- **Turn commit** (`computeTurnCommit` tests, prior art: "a follower whose Enabled gate failed"): a follower inside the new reach stays, one outside parts ways; the swap happens at the commit where the gate changes.
- **Reader parity** (prior art: the Enabled gate's harness in the GameViewer tests): an Away entity is absent from scene, here, nearby and map readers and from place-based AI context, present in known-entity contexts, and its stats regen and scripts run. Each guard is shown to bite by reinstating the bug.
- **Migration and save load** (`version` tests and save-load tests): an old world migrates to one ungated Routine, twice gives the same result; a v3.7.0 save loads with its Start kept.
- **Editor** (Routine tab tests, prior art: the existing RoutineTab and DayStrip tests): Add Routine, switch, rename, reorder, delete; the empty-Routine warning; Away in the action menu.
- **Opening** test: an entity whose Routine depends on a setup pick opens on that Routine.

## Out of Scope

- A Test Bench readout of which Routine applies (Q17).
- Script read or write access to the Routine (Q15).
- Changing the Enabled gate's opening read to the post-setup state. Named as a follow-up.
- Sunmeadow world content. The world-side partners are a ticket in the Sunmeadow breeder spec.
- Gates on single Schedule rows.

## Further Notes

- The World Option Condition depends on world-options ticket 04 (in progress). Until it lands, Routine gates take every other Condition kind; whichever lands second wires Option values into the Routine gate input, as 04 and 07 agreed.
- The host gate editor and the resolver pass come from world-options ticket 07. This effort reuses both.
- ⚠️ Export-shape reminder: worlds (Routines, Away) and saves (per-Routine rolls) both change.
