# Spec: World Options

Status: ready-for-agent
Spec session: world-options — spec

## Problem Statement

Authors have no plain way to set up a world for the player or to switch parts of it on and off.

- **Setup choices are faked with traits.** Open Chat offers Reply Length, Style and Pacing as trait groups with one pick each. Each trait has no AI text and works only through placeholder pins. A trait is meant to describe a character, so this reads wrong to the player and the author.
- **Entities and locations are always there.** A stat can start disabled until a trait turns it on, but an entity or a location cannot. Sugarscape uses an entity's traits to carry a place's open and closed state.
- **The player can walk anywhere.** Travel rules bind only the AI router (ADR-0006). An author who wants a barred room can only say so in prose, as Veilwood does, and the player can still click in.

## Solution

Three additions that share one gate model.

- **World Options.** A new **Options** tab in the World Editor holds a flat list of World Options. Each is a choice, a boolean or a number. At new game the player picks shown Options in a section above the traits. Options flagged for mid-game change also appear in a new in-game tab. An Option acts only through placeholder pins and a new World Option Condition. It never adds text to the AI. Scripts can read and write any Option.
- **Enabled.** Entities and locations get an Enabled gate: Requirement Rows, the same as a trait's Requires. With no rows, the entity or location is always on. When the gate fails, it is fully hidden from the player and the AI. A disabled entity is inert, like a disabled stat. A disabled location is absent with its whole subtree.
- **Locked.** Locations get a Lock gate. A locked location still shows to the player and the AI, but no one can move the player in except a script. The player sees the author's Locked text, or else a lock line.

Scripts never write Enabled or Locked directly. They write a World Option, and the gates test it.

## Rulings

- **Q1 Enabled driver.** World Options drive Enabled in play, through the gate (Q7). Scripts get no direct Enabled write.
- **Q2 Disabled location.** A disabled location is absent from the world with its whole subtree: graph, map, list, AI. Connections through it break; routines fall back as they do for a missing place.
- **Q3 Lock binds.** Lock blocks every move into the location: the List, the Map, the Move-to chip and the AI router. A script's `location.move` ignores it.
- **Q4 Unlock.** Scripts unlock a location by writing a World Option that the Lock gate tests. The gate is the only source of Locked.
- **Q5 Name.** The editor tab is **Options**. The player sees **World Options**. The glossary term is **World Option**.
- **Q6 Types.** Choice (pick one), boolean, and number.
- **Q7 Enabled gate.** Enabled is a Requires-style gate: Requirement Rows with every existing Condition kind plus the new World Option Condition. On while any row holds; no rows = always on.
- **Q8 Indirect scripts.** A script that writes an Option may turn an entity or location on or off through its gate. That is intended.
- **Q9 Leaving.** An entity that becomes disabled leaves the scene at the next turn commit, and any follow ends.
- **Q10 Standing.** If the player's current location becomes disabled, the player stays and the location stays visible to them until they leave. Its children follow the same rule.
- **Q11 Lock line.** A locked location shows optional author-written Locked text. Without it, it shows the lock line with hidden Options left out, or just "Locked" when nothing remains.
- **Q12 Starts.** The new-game start pick skips disabled and locked starting locations.
- **Q13 Effects.** A World Option acts only through placeholder pins and Requirement Conditions. It has no AI text.
- **Q14 When set.** The player sets shown Options at new game. A per-Option flag allows changing it mid-game.
- **Q15 Shown to Player.** Each Option has a Shown to Player flag. Hidden Options never appear at setup, in the in-game tab, or in lock lines; they serve as script and gate state.
- **Q16 Open Chat.** This effort converts Open Chat's Reply Length, Style and Pacing traits into World Options.
- **Q17 Script writes.** Scripts can write any Option, a player-chosen one included.
- **Q18 Setup.** At new game, shown Options appear in their own section above the traits on the trait selection screen. A world with no shown Options shows no section.
- **Q19 Pins.** Each choice value and each boolean state can carry placeholder pins. A number Option has no pins.
- **Q20 Scope.** World Options are world-level and flat: no owner, no groups, no gates on the Options themselves.
- **Q21 Old saves.** Existing Open Chat saves start each Option at its default. No save migration.
- **Q22 Mid-game tab.** Mid-game Options live in their own in-game tab, the rightmost tab of the right panel. A change applies at the next turn commit.
- **Q23 Inert.** A disabled entity is fully inert: its stats, regen, traits and scripts pause and resume where they paused.
- **Q24 Number.** A number Option has a required min and max. The player sets it with a slider.
- **Q25 Test Bench.** Test Bench lets the author pick Option values. Elsewhere outside play, gates read each Option's default, and the editor shows every entity and location.
- **Q26 Tab contents.** The in-game tab lists only Options flagged for mid-game change. With none, the tab does not show.
- **Q27 Stranded.** An enabled entity whose every place is disabled is offstage: out of every scene and the AI's reach. Its stats keep running.
- **Q28 Lock and AI.** A locked location and the entities in it stay visible to the AI (Nearby context, Known In). Only the router is barred from moving the player in.
- **Q29 Blank owner.** In an entity's Enabled gate, a Condition with no owner reads the entity itself. A location is not an owner, so a blank owner in a location gate reads the played persona, as location image rules do.
- **Q30 Self-lock warning.** The editor warns under an entity's Enabled gate when its rows test only that entity's own stats, since such a gate can never reopen once it fails.
- **Q31 Pin rank.** Option pins rank just below trait pins: Code Pin > descriptor > location > trait > Option > value. Option is a new pin source kind that the placeholder side lists and traces like trait pins, the Test Bench lens included. (Ticket 03 question.)
- **Q32 Description.** A World Option carries an optional player description shown under its control at new game, never sent to the AI. Choice values and the boolean have names only. (Ticket 03 question.)
- **Q33 Numbers.** Number Options are whole numbers with an optional step (default 1). The default clamps into min–max. (Ticket 03 question.)
- **Q34 Tab.** The editor's Options tab is always shown, not advanced-only. (Ticket 03 question.)
- **Q35 Setup trigger.** A world with at least one shown Option gets the setup screen even with no traits. Start with defaults applies every Option's default. A stale choice id or an out-of-range number in a save reads the default. (Ticket 03 question.)
- **Q36 Resolver timing and scope.** The resolver derives the in-play view live from committed playthrough state; gate inputs change only at commit, which satisfies Q9 and Q22. It gates every in-play entity by its own gate, library and runtime entities included; one with no gate is on. The played persona is always on. (Ticket 01 question.)
- **Q37 Option pins path.** Option pins go through the existing pin collection beside trait pins, not through the resolver. Ticket 03 does not wait for 01. (Ticket 01 and 03 question.)
- **Q38 Position resumes.** A re-enabled entity comes back at its stored position with its engine state (start, hold), not wherever its routine would place it fresh. A follow still ends at disable (Q9). The position engine's drop of entities outside the cast skips disabled entities. (Ticket 01 evidence.)

## User Stories

### World Options: authoring

1. As an author, I want an Options tab in the World Editor, so that I can set up switches without inventing traits.
2. As an author, I want to add a choice Option with named values, so that the player can pick one style, length or mode.
3. As an author, I want to add a boolean Option, so that I can model a simple on/off switch.
4. As an author, I want to add a number Option with a min and a max, so that the player can tune an amount within bounds.
5. As an author, I want to set each Option's default value, so that a new game and an old save start somewhere sensible.
6. As an author, I want to attach placeholder pins to each choice value, so that a pick changes the prompt text exactly as Open Chat's traits do today.
7. As an author, I want to attach placeholder pins to each boolean state, so that on and off can each pin text.
8. As an author, I want to mark an Option Shown to Player or hidden, so that I can keep internal flags out of the player's way.
9. As an author, I want to flag an Option as changeable mid-game, so that the player can adjust preferences without starting over.
10. As an author, I want to reorder Options, so that the setup section reads in a sensible order.
11. As an author, I want a World Option Condition in every Requires editor, so that traits, image rules, Enabled and Lock can test an Option.
12. As an author, I want an Option Condition to test a choice value, a boolean state, or a number comparison, so that one Condition kind covers all three types.
13. As an author, I want scripts to read and write any Option, so that story events can flip switches.
14. As an author, I want Test Bench to let me pick Option values, so that I can check gates and pins under each setup.
15. As an author, I want Options to carry no AI text, so that they never describe the world by accident.

### World Options: playing

16. As a player, I want a World Options section above the traits at new game, so that I set up the world before I build my character.
17. As a player, I want each shown Option to start at its default, so that I can skip the section.
18. As a player, I want a slider for number Options, so that I can't enter an out-of-range value.
19. As a player, I want a World Options tab at the right end of the right panel, so that I can change mid-game Options during play.
20. As a player, I want a mid-game change to take effect on my next turn, so that the current turn stays consistent.
21. As a player, I never want to see hidden Options, so that the author's internal flags stay internal.
22. As a player of Open Chat, I want Reply Length, Style and Pacing as World Options, so that they read as setup choices, not traits.
23. As a player with an old Open Chat save, I want the save to load with default Options, so that it keeps working.

### Enabled

24. As an author, I want an Enabled gate on each entity, so that an entity can appear only under some conditions.
25. As an author, I want an Enabled gate on each location, so that a place can exist only under some conditions.
26. As an author, I want the Enabled gate to use the same Requirement Rows as Requires, so that I learn one editor.
27. As an author, I want an empty Enabled gate to mean always on, so that existing worlds behave as before.
28. As an author, I want a blank owner in an entity's gate to read that entity, so that the gate matches the entity's trait gates.
29. As an author, I want a warning when an entity's Enabled gate tests only its own stats, so that I don't build a gate that can never reopen.
30. As a player, I never want to see a disabled entity anywhere: scene, map, lists, character panels, mentions, so that hidden content stays hidden.
31. As a player, I never want the AI to mention a disabled entity or location, so that the story doesn't leak it.
32. As an author, I want a disabled entity to be inert, so that its stats, regen, traits and scripts pause like a disabled stat's.
33. As an author, I want a re-enabled entity to resume where it paused, so that its state is not lost.
34. As a player, I want a disabled entity to leave the scene at the next turn commit, so that it never vanishes mid-turn.
35. As a player, I want a follow to end when the follower becomes disabled, so that nobody hidden tags along.
36. As an author, I want a disabled location to remove its whole subtree, so that a closed district hides every room in it.
37. As a player standing in a location that becomes disabled, I want to stay there until I leave, so that I'm never teleported without narration.
38. As an author, I want entities whose every place is disabled to be offstage, so that they don't appear in a place that doesn't exist.
39. As an author, I want an offstage entity's stats to keep running, so that only its own gate makes it inert.
40. As an author, I want the new-game start to skip disabled starting locations, so that a game never opens in a hidden place.

### Locked

41. As an author, I want a Lock gate on each location, so that I can bar entry until conditions hold.
42. As an author, I want the Lock gate to use the same Requirement Rows, so that I learn one editor.
43. As an author, I want to write optional Locked text, so that the player reads an in-world reason ("The gate is barred").
44. As a player, I want to see locked locations on the List and the Map, so that I know they exist.
45. As a player, I want a locked location to show the author's Locked text or a lock line, so that I know why I can't enter.
46. As a player, I never want a lock line to name a hidden Option, so that internal flags don't leak.
47. As a player, I want the List and the Map to refuse travel into a locked location, so that the lock means something.
48. As a player, I want the Move-to chip never to offer a locked location, so that the AI can't suggest a barred move.
49. As an author, I want the AI router never to move the player into a locked location, so that narration respects the lock.
50. As an author, I want a script's `location.move` to ignore the lock, so that I can still move the player in on purpose.
51. As an author, I want the AI to still see a locked location and who is inside, so that the narrator can describe the barred door.
52. As an author, I want a script to unlock a location by writing an Option, so that a story event opens the way.
53. As an author, I want the new-game start to skip locked starting locations, so that the game never begins behind a lock.

## Implementation Decisions

- **In-Play World resolver (new deep module).** One pure function takes the authored world and the playthrough state (Option values, trait state, stats, clock, persona, current location) and returns the in-play view: which entities and locations are on, which locations are locked, and the lock-line parts. Option pins do not pass through it (Q37). It owns the subtree rule (Q2), the standing exemption (Q10) and the stranded rule (Q27). Every in-play reader of entities and locations goes through it instead of the raw world. Readers to move include presence and the scene cast, routines and positions, Known In and reach, the List and the Map, openings and the start pick, the navigation graph and the router's walk, the AI context builders and chip values, the script `entities` and `locations` globals, World Tools snapshots, the Formaquestion Player View, Test Bench, mention detection, image tags, the inventory pass, following, placeholder pins and relationships.
- **Gate evaluation reuses the Requirement evaluator.** Enabled and Lock gates run through the same evaluator as traits and image Visibility rules. Location gates run owner-less like location image rules. Entity Enabled gates resolve a blank owner to the entity (Q29).
- **World Option Condition.** A new Condition kind on the Requirement union. It names an Option by id with its name stored for display, like other Conditions. It tests a choice value, a boolean state, or a number with the stat comparison operators. It has no owner. Choice and boolean tests can carry Not; a number test uses the operators instead.
- **Lock line.** The existing lock-line builder renders location Lock gates. It drops World Option Conditions for hidden Options (Q11).
- **Travel gate.** One function answers "can the player be moved into this location by this route". The List, the Map, the Move-to chip, the router's candidate walk and the start pick all call it. `location.move` does not (Q3). A new ADR records that Lock binds player travel and supersedes that part of ADR-0006; navigation rules still bind only the AI.
- **Timing.** Gates and Option changes are read once per turn commit, like Time Conditions (Q9, Q22). Option values written by scripts follow the existing script write timing.
- **Runtime state.** Option values live in GameplayContext and the save envelope, as a playthrough record keyed by Option id, following the `loreToggles` precedent. Missing ids read the Option's default (Q21). Gameplay never writes GameDataContext.
- **Inertness.** A disabled entity's stats, regen, traits and scripts pause using the same machinery that pauses a disabled stat (Q23).
- **Script surface.** A new global exposes World Options by name, readable and writable by value. Entity and location fields stay read-only; no Enabled or Locked write exists.
- **Editor.** A new Options tab in the World Editor. Entity and location panels gain Enabled and Lock gate editors built from the existing Requires editor. The Q30 warning shows under an entity's Enabled gate.
- **Play UI.** A World Options section above the traits on the trait selection screen (Q18). A new rightmost tab in the right panel lists mid-game Options (Q22, Q26). The List and the Map show locked locations with the lock line or Locked text and refuse travel.
- **Open Chat conversion.** Reply Length, Style and Pacing become choice Options with the same pins; their trait groups are removed. The bundled world JSON changes.
- **Export shape.** ⚠️ World shape: new `options` list on the world, Enabled gate on entities and locations, Lock gate and Locked text on locations, new Condition kind. Save shape: new Option values record.
- **Glossary.** Add World Option, Enabled (entity and location sense), Locked location and the World Option Condition to CONTEXT.md. "Locked" for a location means its Lock gate fails, matching a Locked trait.
- **Copy.** Every label, hint and the default lock text are written from the Writing Guide at build time; this spec fixes no user-facing wording beyond the names in Q5.

## Testing Decisions

- A good test drives external behavior through a seam and asserts what the player or the AI would see. It never mirrors the implementation. Each guard is proven by reinstating the bug.
- **In-Play World resolver (the main seam).** Pure unit tests: gates on and off per Condition kind, subtree removal, the standing exemption, stranded entities, the blank-owner rule for entities and locations, hidden Options left out of lock lines, start-pick filtering. Prior art: `traitGates` and `imageVisibility` tests.
- **Reader coverage.** A parity-style test builds a world with one disabled entity and one disabled location and asserts neither appears in any in-play output: AI context, chip values, script globals, World Tools snapshot, Formaquestion Player View, Test Bench. Prior art: the turn pipeline parity suite.
- **Turn commit.** `computeTurnCommit` tests for leaving at the next commit, follow ending, and a mid-game Option change applying at the next commit. Prior art: `computeTurnCommit.test.ts`.
- **Test Bench.** `runRules`/lens tests for the Options picker changing gate results. Prior art: Test Bench lens tests.
- **Scripts.** Executor tests for reading and writing Options and for `location.move` ignoring a lock. Prior art: `statCodeExecutor` write tests.
- **Saves.** Round-trip of Option values; an old save loads with defaults.
- **UI.** Playwright for the setup section, the in-game Options tab, and refused travel on the List and the Map. Static frames through the dev-router for the editor tab and gate editors.

## Out of Scope

- Script writes to Enabled or Locked on entities, locations or stats.
- Choice lists with multiple picks, Option groups, per-entity Options, and gates on Options themselves.
- AI text on Options.
- Condition kinds for "visited a location" or "met an entity".
- Migrating old Open Chat trait picks into Options.
- Gating player travel on navigation rules (ADR-0006 stands for those).
- The existing "locked row" wording for Strict rows in the script surface copy.

## Further Notes

- ⚠️ Export-shape reminder: this changes both the world and the save shape.
- The agent fact sheet behind the grill found no single in-play filter today: stats copy runtime state onto the record, and entity readers use scattered cast filters. The resolver is the first ticket so every later ticket reads through it.
- Sugarscape's Daylight Seam and Veilwood's Veil's Hold are candidate follow-ups to move onto Enabled and Lock once this lands.
