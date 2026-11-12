# Spec: Persona Start Locations

Status: done
Status note: Closed 2026-11-12; tickets 01–03, last landing cbcb5ec82. Review: spec text corrected. Gates green on 2026-11-12.
Spec session: persona-start-locations — spec

## Problem Statement

A Persona-Only entity and the Custom Persona both stand for the player, but the entity Presence tab treats them differently.

- The Custom Persona shows one **Locations** list. At Enter World it fills the None slot, so that list is probably never offered as a starting location (unverified; the first ticket confirms it).
- A Persona-Only entity shows the full Unique/Generic editor: Placement, Starts, routine rows, Can Also Go and Known In. It exists only while it is the picked persona, and then it is the player. So only its Start places can ever matter.

Under the hood, an unpicked Persona-Only entity still holds a Position from its routine, and the Known In lookup can list it. It is never in the cast, so neither should happen.

## Solution

Both personas get one field on the Presence tab: **Start Locations**, a location multiselect. As a player, picking such a persona at Enter World adds its Start Locations to the world's flagged starting locations, and the first one is preselected. The author adds special places to start from; the world's base list stays.

Both store the list in the entity's `locations` field, the shape v3.6.2 shipped. Switching an entity's Persona role converts between Starts and the list. An unpicked Persona-Only entity and the Custom Persona never hold a Position or a Known In listing.

## Rulings

- **Q1 Data.** Persona-Only and the Custom Persona store start locations as the `locations` list. The routine migration leaves a Persona-Only entity unconverted, the same as the Custom Persona: no kind, no Starts.
- **Q2 Meaning.** At Enter World a persona's Start Locations join the world's flagged starting locations, and the first one is preselected, the same as a Playable entity's Start places today.
- **Q3 Custom Persona.** Its Start Locations apply under None and under a library persona: wherever its traits apply.
- **Q4 Role switch.** Switching between Playable and Persona-Only converts: Start places become the list; each listed location becomes one Unique Start with an empty Schedule. Routine rows are dropped on the way into the list.
- **Q5 Field.** The existing location multiselect, labeled **Start Locations**, without a Player's Starting Location option. An empty list means the world's base list only.
- **Q6 Runtime.** An unpicked Persona-Only entity and the Custom Persona never hold a Position or a Known In listing. Reproduce today's behavior first; the fix comes with a test.
- **Q7 Every switch.** The Q4 conversion applies to every change into or out of Persona-Only and Custom Persona, Cast included. Cast and Playable keep Starts; Persona-Only and Custom Persona keep the list.
- **Q8 One cast rule.** The positioned cast and the Known In lookup both follow `inCast`: they drop the Custom Persona, every unpicked Persona-Only entity, and the played persona of any role. A played persona is the player, never someone known about. (Ticket 01 question.) Ticket 01 found the narrator request never leaked, since the live scene already applies `inCast`; the Position at opening did, and the chip scene and Test Bench read the Known In roster over raw world entities.
- **Q9 Hidden fields drop.** A switch into Persona-Only or Custom Persona also drops `onMap` and `knownIn`; a switch back starts with both absent. Undo restores the whole entity. (Ticket 02 question.)
- **Q10 One hint.** Both personas show one Start Locations hint, written from the Writing Guide. The existing persona hint stays where it is. (Ticket 02 question.)
- **Q11 One preselect rule.** Every persona preselects its first start place that is a flagged starting location, else its first one, the same as a Playable entity today. (Ticket 03 question.)
- **Q12 Test Bench follows.** The Test Bench opening reads persona start places through the same function, so the Custom Persona list applies there under None. (Ticket 03 question.)
- **Q13 Card line.** The Custom Persona option card shows where it starts, as a world persona card does, when its list resolves to a location. (Ticket 03 question.)

## User Stories

1. As an author, I want a Persona-Only entity's Presence tab to show only Start Locations, so that I don't edit a routine that never runs.
2. As an author, I want the Custom Persona's Presence tab to show the same Start Locations field, so that both player stand-ins work one way.
3. As an author, I want the field labeled Start Locations, so that I know it sets where the player can begin as this persona.
4. As an author, I want an empty Start Locations list to keep the world's base starting locations, so that a persona needs no setup to be playable.
5. As an author, I want Start Locations to add to the world's starting locations, not replace them, so that one persona can open an extra entry point.
6. As an author, I want no Player's Starting Location option in the field, so that I don't pick a choice the base list already covers.
7. As an author, I want Placement, routine rows, Can Also Go and Known In hidden for these personas, so that the tab shows only what applies.
8. As an author, I want switching an entity from Playable to Persona-Only to keep its start places as Start Locations, so that I don't lose where it begins.
9. As an author, I want switching from Persona-Only to Playable to turn each Start Location into a Start, so that the entity is ready for a routine.
10. As an author, I want switching to or from Custom Persona to convert the same way, so that every role change keeps the places.
11. As an author, I want a Cast entity marked Persona-Only to keep its start places, so that marking a character playable-only loses nothing but the routine.
12. As an author, I want an undo of a role switch to bring back the Starts and routine rows, so that a mis-click costs nothing.
13. As an author, I want a v3.6.2 world's Persona-Only entity to open with its locations as Start Locations, so that my released worlds keep working.
14. As an author, I want the saved world to keep `locations` for these personas, so that the file stays readable by v3.6.2.
15. As a player, I want a persona's Start Locations listed at the Starting Location step after I pick it, so that I can begin where that character belongs.
16. As a player, I want the persona's first Start Location preselected, so that I start in the right place without choosing.
17. As a player, I want to still pick any of the world's starting locations, so that the persona widens my choices instead of narrowing them.
18. As a player who picks None, I want the Custom Persona's Start Locations offered, so that the world's own player character can start where the author intended.
19. As a player who picks a library persona, I want the Custom Persona's Start Locations offered too, so that my own character gets the same entry points.
20. As a player, I want a Persona-Only character I didn't pick to never appear in the story, so that it doesn't show up as a stranger or a known name.
21. As a player, I want a Persona-Only character I didn't pick to never appear on the map, so that the map shows only the cast.
22. As a player, I want the AI never to hear about a Persona-Only character I didn't pick through Known In, so that the narrator doesn't mention someone who isn't there.
23. As an author reading the help, I want the Presence and persona pages to explain Start Locations, so that I know what the field does.

## Implementation Decisions

- **Role decides the shape.** A Persona-Only or Custom Persona entity holds `locations` and no `kind`, `starts` or `traversable`. A Cast or Playable entity holds a kind and Starts. One pure conversion function maps an entity to its new role's shape and is the only writer of that change. The Persona control calls it.
- **Conversion, list → Starts:** one Unique Start per listed location, weight 1, empty Schedule, in list order. **Starts → list:** the named Start places in Start order, each once, without Player's Starting Location. Generic Starts convert the same way.
- **Migration.** The routine migration skips any entity with the Persona and Persona-Only marks, as it already skips the Custom Persona. It stays idempotent.
- **Presence tab.** The routine editor's Custom Persona branch becomes the persona branch: one Start Locations multiselect over every location, for Persona-Only and Custom Persona alike. Known In is hidden for both. The hint that the persona moves with the player stays where it reads today.
- **Enter World.** The offered list and the preselect read a persona's start places through one function. For a world persona it reads Starts (Playable) or the list (Persona-Only). Under None or a library persona, it reads the Custom Persona's list when the world has one.
- **Runtime.** The positioned cast drops an entity with the Persona and Persona-Only marks unless it is the played one, as it already drops the Custom Persona. The Known In lookup drops the same entities. Both match `inCast`.
- **Export shape.** World `.json` changes against the unreleased build only: a Persona-Only entity carries `locations` instead of `kind`/`starts`. It matches v3.6.2, so no compatibility code is written for the unreleased form. No tracked world holds a Persona-Only entity today.
- **Copy.** Field label, hint and help text follow the Writing Guide; the help pages for entity Presence and persona authoring change with the field.

## Testing Decisions

- Tests read behavior through the highest seam: what the editor stores, what Enter World offers, what a turn sends. No test reads the conversion function's internals or component state.
- **World Editor bench:** the Presence tab of a Persona-Only and a Custom Persona entity shows Start Locations and no routine. A Persona control switch in each direction stores the converted shape, and undo restores it. Prior art: the entity Presence tab and Persona control tests on the World Editor bench.
- **Migration:** a v3.6.2 Persona-Only entity keeps its `locations` and gains no kind; a second pass changes nothing. Prior art: the routine migration tests.
- **Persona pick:** Start Locations join the flagged list and preselect, for a Persona-Only world persona and for the Custom Persona under None and under a library persona. Prior art: the persona pick tests.
- **Game turn:** with an unpicked Persona-Only entity listed at the player's location and a Known In pick there, the turn's request body and the map positions never name it. This test runs red on today's code first, and the fix is proven by reinstating the leak. Prior art: the GameViewer turn request tests.

## Out of Scope

- Playable entities: they stay in the cast when unpicked, so they keep the full routine editor.
- The library entity editor: it has no Presence tab.
- Start weights or a "picked first" order inside Start Locations beyond the first-listed preselect.
- Any change to the world's own starting location flags.

## Further Notes

- The routine editor's Custom Persona branch sits near the Placement row, where the map-strangers effort adds its On Map row. Coordinate with that ticket before editing the file.
- 📦 Export-shape reminder: this changes the world `.json` shape for Persona-Only entities.
