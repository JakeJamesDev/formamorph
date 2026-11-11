# Spec: Entity Places

Status: ready-for-agent
Spec session: entity-places — spec
Status note: Written 2026-11-11 from the architecture review. Implementation waits until NPC Schedules tickets 29, 30 and 31 land (Q4). Tickets 01–10; 01 is the first, 03–09 run in parallel after 02, 10 is last.

## Problem Statement

Different parts of the app disagree about where an entity is.

An author sees it in the World Editor. An entity that begins at Player's Starting Location does not show on a starting location's Presence tab. The Openings tab gives that entity an "at no start" badge. The script hover card for a location lists a Unique entity at every place its routine names, and the same script run places it at one. Morphie's list of an entity's locations leaves out Player's Starting Location and Can Also Go.

A player sees it in play. A Unique entity the player met can show at every routine place the player visited. A played persona with a routine is offered row places as places to begin.

The cause is one stored field, an entity's `locations` list, which carries three meanings: plain membership for an entity with no kind, a list derived from the routine for an entity with a kind, and "where it stands now" on copies made in play. Each reader must know which of the three it holds. About twenty readers exist, ten get a wrong answer, and three fixes in one week corrected readers one at a time.

## Solution

Every part of the app asks one module where an entity is, and names which of four questions it asks:

- **Position**: where it stands now in the running game.
- **Sample Placement**: where authoring places it at the start of the story.
- **Presence**: every place it can be, with the reason for each place.
- **Start places**: where it can begin.

An entity with a kind no longer stores a list of locations. Its routine is the only source. An entity with no kind keeps its stored list, and the module reads it.

The author and the player then see one consistent answer on every screen, in scripts, in the Test Bench and in Morphie.

## User Stories

1. As an author, I want an entity that begins at Player's Starting Location listed on the Presence tab of each starting location, so that I see the whole cast of that location.
2. As an author, I want every location to count as a starting location for that list when I flagged none, so that the Presence tab matches what a new game does.
3. As an author, I want each Presence tab row to give the reason the entity can be there, so that I know why it is listed.
4. As an author, I want the canvas marks for a picked entity to match its Presence tab rows, so that the map and the list never disagree.
5. As an author, I want the canvas Known In marks to show the entity's routine places the same way under every Known In mode, so that the marks mean one thing.
6. As an author, I want a row place that the Start cannot reach left out of where the entity can be, so that I see only what play can produce.
7. As an author, I want the Test Bench to keep its finding for a row place the Start cannot reach, so that I still learn about the broken row.
8. As an author, I want the script hover card for a location to list the entities the sample run places there, so that the card and my Test Code run agree.
9. As an author, I want an entity that begins at Player's Starting Location on that hover card when the location is the sample start, so that the card does not hide it.
10. As an author, I want the Openings tab to count an entity as at a start only when it can begin there, so that the chance it shows is true.
11. As an author, I want an entity that begins at Player's Starting Location to show as at the start on the Openings tab, so that it loses the "at no start" badge.
12. As an author, I want the Test Bench rule for a location with no entities to count an entity that begins at Player's Starting Location, so that I get no false finding.
13. As an author, I want the Test Bench rules, the Presence tab and the canvas to read the same Presence, so that a finding always matches what I see.
14. As an author, I want Morphie to name every place an entity can be, with Player's Starting Location and Can Also Go, so that its answers match the editor.
15. As an author, I want Morphie to tell a Start place from a row place, so that it can say where an entity begins.
16. As an author, I want a Unique entity I add from the library to keep its routine in the new world, so that I do not rebuild its Starts.
17. As an author, I want that entity's Starts and rows mapped to the new world's locations, so that it never points at a place the world lacks.
18. As an author, I want a carried Unique entity with no Start that maps to begin at the location I added it to, so that it is placed somewhere.
19. As an author, I want a Generic entity I carry to behave as it does today, so that nothing I learned changes.
20. As an author, I want to open a world I made before this change and see every entity where it was, so that the update costs me nothing.
21. As an author, I want my exported world file to hold a routine and no second list of places for an entity with a kind, so that the file cannot contradict itself.
22. As an author, I want an exported entity card to follow the same rule, so that a card and a world agree.
23. As an author, I want the Custom Persona's locations to work as today, so that the persona's start does not change.
24. As an author, I want the bundled worlds to open with every entity in the same places as before, so that the examples stay correct.
25. As an author, I want chip previews in the editor to keep using the Sample Placement, so that a preview shows one stable cast.
26. As a player, I want a Unique entity I met to show at one place in Morphie's view of the world, so that I am not told it is in several places.
27. As a player, I want a played persona with a routine offered only its Start places when I begin, so that I cannot begin somewhere it never starts.
28. As a player, I want a persona that begins at Player's Starting Location offered the world's starting locations, so that it has a place to begin.
29. As a player, I want the opening I get on a redraw of page one chosen from who stood at my start when the game opened, so that an entity that walked off later does not change the pool.
30. As a player, I want an entity that has no Position to be nowhere, so that it is never in two places at once.
31. As a player, I want the cast at my location to be the same in the narration, the Entities tab, the chips and scripts, so that the story and the panels agree.
32. As a player, I want my saves from before this change to load with everyone where they were, so that the update does not move the cast.
33. As a script author, I want `present` in a Test Code run and in a live turn to come from the same reader, so that a script that passes the test passes in play.
34. As a script author, I want a script run that has no live positions to use the Sample Placement, so that no entity stands in several places during the run.
35. As a developer, I want one module that answers the four questions, so that a new reader has one place to ask.
36. As a developer, I want lint to refuse a read of an entity's `locations` outside that module, so that a new reader cannot drift.
37. As a developer, I want one test that holds every reader to the module's answer on one world, so that a reader that drifts fails a test.
38. As a developer, I want one name for a Generic entity's standing body, so that "presence" has one meaning in code and specs.
39. As a developer, I want the ADRs to record that an entity with a kind owns a routine and no membership list, so that a later review does not restore the list.

## Implementation Decisions

Rulings from the grill of 2026-11-11.

- **Q1.** An entity with a kind stops storing `locations`. Its Starts, rows and Can Also Go are the only source. **This changes the export shape** of world files and entity card files. Released v3.6.2 has no entity kinds, so it reads such an entity from a newer world as placed nowhere.
- **Q2.** The Entity Places module answers for every entity. An entity with no kind keeps its stored `locations` as plain membership, and only the module reads it. No reader outside the module touches the field.
- **Q3.** A lint rule forbids a read of an entity's `locations` outside the module. It joins the existing custom rules and lands last, after every reader has moved. Writers of the no-kind membership list go through the module too.
- **Q4.** Implementation waits until NPC Schedules tickets 29, 30 and 31 land. They edit the same readers.
- **Q5.** A one-time rewrite removes the stored list from entities with a kind in the bundled worlds and in `worlds-wip`. There is no migration step for it: entity kinds never shipped, so the stored derived list is an unreleased form. A dev world that still carries the field keeps a dead field until its next save.
- **Q6.** The module answers exactly four questions: Position, Sample Placement, Presence and Start places. Each reader names the one it asks. The copies that today overwrite `locations` in play and for the opening cast go away as an interface; whether the module keeps a projection inside is its own concern.
- **Q7.** Presence is one answer: each place the entity can be, with one or more reasons. The reasons are: it begins there, a Schedule row names it, Can Also Go lists it. Player's Starting Location always expands to the world's starting locations, or to every location when none is flagged. Can Also Go set to Anywhere is a flag on the answer and is not expanded to every location. Readers filter by reason; the five current computations of "places a routine names" reduce to this one.
- **Q8.** Presence leaves out a row place that has no path from its Start, as the position engine does. The Test Bench keeps its own finding for such a row.
- **Q9.** Each reader that gets a wrong answer today is corrected when it moves to the module, in the same ticket, with a changelog line. The ten:
  1. The Presence tab misses an entity that begins at Player's Starting Location.
  2. Canvas pick marks with Known In picks miss Player's Starting Location and Can Also Go, and skip the path check.
  3. The script hover card for a location lists a Unique entity at every routine place; it takes the Sample Placement.
  4. Morphie's world index misses Player's Starting Location and Can Also Go and does not tell a Start from a row.
  5. Morphie's player view reads the authored list on one path in play; it takes Position.
  6. The Openings tab counts a Unique entity as at the start through any row place, and gives a Player's Starting Location entity the "at no start" badge.
  7. Persona start offers use row places and ignore Player's Starting Location; they take Start places.
  8. The "starts met" check for the played persona counts row places; it takes Start places.
  9. The page-one opening redraw reads live Positions against the opening's start; it takes the placement the game opened with.
  10. The Test Bench rule for a location with no entities ignores Player's Starting Location when no location is flagged.
- **Q10.** In play, an entity with a kind and no Position stands nowhere. A script run that has no live positions takes the Sample Placement.
- **Q11.** A Unique entity carried from the library into another world has its Starts and rows mapped to the new world's locations, by the rule a Generic entity already follows: a Start whose place maps is kept with its rows remapped, and with none kept the entity takes one Start at the mapped place. The link-repair path follows the same rule.
- **Q12.** Glossary terms: Position, Sample Placement, Presence, Start places. They are words for code, specs and chat. User-facing copy keeps its own words.
- **Q13.** ADR-0017 records the ownership change and replaces the membership part of ADR-0003 for entities with a kind.
- **Q14.** This is its own effort, `entity-places`.
- **Q15.** One standing body of a Generic entity is a **Generic Entity Instance**. "Presence" no longer names it. "Instance" and "Generic Instance" are avoided: neither says what the thing is. Code identifiers that use "presence" for the body are renamed in this effort. Save-file keys are not renamed; the rename is of types, functions and prose only, so the save shape does not change.

Other decisions:

- The module sits on the position engine and the game's side of it. The engine's rules do not change.
- Two modules that only restate a walk over the routine fold into the module: the Presence tab's reason lines keep their wording but take their places and reasons from Presence, and the canvas pick's routine places come from Presence.
- The helper that rebuilds the derived list and all of its call sites go.
- The inverted index of ADR-0003 ("who is at this place") stays as a query on the module. Roster order stays the cast's own order.
- Migrations that give a legacy entity its kind and Starts keep reading the legacy list as input, through the module, then drop it.
- The world format doc and the script guide change where they name the stored list.

## Testing Decisions

A good test here gives the module a world, and for Position a position book, and reads the four answers. It asserts places and reasons. It does not assert on how the module walks a routine.

- **The module's interface.** Cover each kind (Unique, Generic, none), each reason, Player's Starting Location with and without flagged starting locations, Can Also Go as a list and as Anywhere, a row place with no path from its Start, an entity with no Position, a Generic entity with two Generic Entity Instances in one place counted once, and runtime characters. Prior art: the entity kind, entity presence, position play and presence reasons test files, and the shared entity kind fixture.
- **The agreement test.** One fixture world. Each reader is called through its existing interface and must match the module: the Presence tab lines, the canvas marks, the Test Bench rules, the script hover card, Morphie's world index and player view, the authored and live chip scenes, the Openings tab view, the persona start offers. A reader added later joins this test.
- **The carry.** A Unique entity and a Generic entity carried into a world with a place map: kept Starts, remapped rows, the fallback Start.
- **The lint rule.** In the existing custom-rule test file: a read outside the module fails, a read inside passes, and a `locations` field of another type does not trip it.
- **The bundled worlds.** The bundled world test asserts no entity with a kind stores `locations`, and that every entity's Presence equals what the stored list gave before the rewrite, plus the places Q7 adds.
- **Guards must bite.** Each of the ten corrections is proven by restoring the old read once and seeing its assertion fail.
- No new mount tests of the game view or the World Editor. Existing mount tests keep passing; one that asserted a wrong answer from Q9 is corrected, and the ticket says so.

## Out of Scope

- The other candidates of the architecture review: the turn apply step, the live sandbox state, the script text readers, the script run report, entity migration, the turn advance.
- Changes to the position engine's rules, to Schedule actions, or to following and waiting.
- Known In. It stays its own field and its own readers.
- A migration step for unreleased worlds (Q5).
- Renaming save-file keys (Q15).
- User-facing copy beyond the changelog lines of Q9 and the doc lines that name the stored list.
- A block or warning when v3.6.2 opens a newer world.

## Further Notes

- **Export-shape reminder.** Q1 changes world and entity card `.json`. Each ticket that touches the writer repeats this in its hand-off.
- **Open checks, UNVERIFIED in the reader trace.** Settle each before its reader moves:
  - which cast the Test Bench opening pool passes to the opening pool reader;
  - how often a script run uses the opening state with no positions (the game view's standalone run and the tool script run);
  - when the opening placement cannot place an entity with a kind, and what that entity's Sample Placement is then.
- **Evidence.** The drift fixes that prompted this: c60fde15e, 167190e0a, 2f1fa5266. The architecture report is `.scratch/architecture-review-2026-11-11.html`.
- **Order.** The module and the agreement test come first. Readers move in groups. The field removal, the bundled-world rewrite and the lint rule come last, together.
