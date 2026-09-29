# Spec: Openings Refresh

Status: done
Spec session: openings-refresh — spec

## Problem Statement

An author can't write an opening for the character the player plays. Every entity opening reads as that entity greeting the player at a location. When the player plays a world persona, the persona's own openings leave the draw, so page one never greets the player as themselves. A player who picks persona A then gets an opening drawn at random from the other personas' openings at the same start. Authors who write "openings for each persona" see a random mix and conclude the feature is broken.

A place can't carry an opening either. An author who wants "you arrive at the docks" must put it on the world, where it draws at every start, or on an entity that stands there.

The world Openings panel also misleads at scale:

- The **Chances At** picker has no way to see every opening at once, and it doesn't filter. Openings that can't draw at the picked start stay on screen, each group with its own "Not at X" hint.
- The default opening card shows whenever the world has no openings of its own, even at a start where entity openings fill the pool.
- The full-width **Add Opening** button under an entity group doesn't say which entity it adds to.
- Opening cards are always expanded. Reordering and tuning weights across a long list means scrolling past every text box.
- The **Player Action | Narration** control overflows its track when a value is selected.
- **Openings** sits in the middle of the entity tabs.

## Solution

Each opening gets a second switch, **Others | Self**. An **Others** opening is today's opening: the entity greets the player. A **Self** opening is a start written for playing as that entity. When the player plays an entity that has Self openings, only those openings draw.

Locations get their own openings. A location's openings join the pool when the game starts at that exact location.

The world Openings panel gets a **Starting Location** filter that opens on **All Locations**. Picking a location filters the list to what can draw there and shows chances. The default opening card shows only where it can actually draw. Groups run World, Locations, Entities. Owned **Add Opening** buttons name their owner.

Opening cards collapse to one line, with every control still live, the way placeholder value cards do. One shared collapse rule serves both editors.

SillyTavern card import keeps working: greetings import as Others Narration openings.

## User Stories

### Self openings

1. As a world author, I want to mark an opening as Self, so that I can write how the story starts when the player plays that entity.
2. As a world author, I want the Others | Self switch beside Player Action | Narration on each opening, so that I set both properties in one place.
3. As a world author, I want the Others | Self switch to show only on entities that can be played, so that the control never appears where it can't matter.
4. As a world author, I want flipping Others | Self to keep my text, kind and weight, so that a misclick costs nothing.
5. As a world author, I want an entity that loses its Persona mark to keep its Self openings in the file, so that re-marking it brings them back.
6. As a world author, I want an unmarked entity's Self openings hidden from the editor, so that the list shows only openings that can draw.
7. As a player, I want the persona I pick to start on one of its Self openings, so that my game opens as the story written for that character.
8. As a player, I want a persona with no Self openings to start on the normal pool, so that personas without authored starts still work.
9. As a player, I want Self openings to replace every other opening in the draw, so that I never get another persona's start.
10. As a player, I want Self openings drawn by weight among themselves, so that an author's odds between a persona's starts hold.
11. As a player, I want the page-one redraw to draw again from the same Self openings, so that regenerating never leaks another start.
12. As a player, I want a persona's Others openings kept out of the draw while I play it, so that page one never greets me as myself.
13. As a world author, I want a persona-only entity's Self openings to draw when a player picks it, so that a persona-only character can have its own start.
14. As a world author, I want a persona-only entity's Others openings never to draw, so that the existing persona-only guarantee holds.
15. As a player, I want a library persona's Self openings to draw in any world I play it in, so that my own character brings its own start.
16. As a library author, I want the Others | Self switch on library entities with the Persona mark, so that I can write their starts once.
17. As a world author, I want the Custom Persona entity to carry Self openings, so that a player who picks None starts on an opening written for the custom character.
18. As a player playing a library persona with no Self openings, I want the world's Custom Persona Self openings to draw, so that the world's custom start still applies.
19. As a player playing a library persona that has Self openings, I want its Self openings to win over the Custom Persona's, so that my character's own start comes first.
20. As a player, I want a persona's Self openings to win over Library Additions' openings, so that who I play decides the start before who I brought along.
21. As a world author, I want the world's Openings switch to turn off Self openings too, so that one switch still means "every game starts on the default".
22. As a player, I want Placeholder chips in a Self opening, including Player Name, to render as they do in any opening, so that Self openings read like the rest.

### Location openings

23. As a world author, I want to write openings on a location, so that a start can open on the place itself.
24. As a world author, I want an Openings tab on the location editor, as its last tab, so that I write a location's openings where I edit the location.
25. As a player, I want a location's openings to join the pool when my game starts there, so that the place's starts mix with the world's and present entities' by weight.
26. As a player, I want a location's openings to draw only when that exact location is my start, so that a parent location's openings don't leak into its children.
27. As a world author, I want a location opening on a location that isn't a starting location to show a No Starting Location badge, so that I know it never draws.
28. As a world author, I want location openings to have Player Action | Narration and weights like other openings, so that they work the same way.
29. As a world author, I want the world's Openings switch to turn off location openings too, so that the switch stays one switch.
30. As a player playing a persona with Self openings, I want location openings kept out of the draw, so that Self openings stay the only pool.

### World Openings panel

31. As a world author, I want a Starting Location filter that opens on All Locations, so that I see every opening in the world at once.
32. As a world author, I want All Locations to show no chances, so that the panel never shows a percentage that belongs to no start.
33. As a world author, I want picking a location to show only the openings that can draw there, so that irrelevant openings leave the screen.
34. As a world author, I want chances shown once I pick a location, so that I can tune the odds at that start.
35. As a world author, I want the filter to list each starting location by name, so that it matches Enter World.
36. As a world author, I want the "Not at X" hint gone, so that the filter does the work the hint used to do.
37. As a world author, I want groups ordered World, Locations, Entities, so that the list runs from broadest to narrowest.
38. As a world author, I want each location with openings to have its own group, with a link to its editor, so that I can jump to it as I do for entities.
39. As a world author, I want Self openings to stay in their owner's group with a Self badge, so that I see them beside the entity's other openings.
40. As a world author, I want a Self opening's chance to be its share of that persona's Self openings, so that the number means what happens when that persona is played.
41. As a world author, I want Self openings to show under every filter value, so that the start-independent openings never vanish.
42. As a world author, I want the default opening card to show at a picked location only when that start's pool is empty, so that it appears only where it would draw.
43. As a world author, I want All Locations to show the default opening card with the names of the starts whose pool is empty, so that I know where players get it.
44. As a world author, I want the default opening card hidden when no start has an empty pool, so that it doesn't imply a start I don't have.
45. As a world author, I want each owned Add Opening button to read "Add Opening to <owner>", so that I know where the new opening goes.
46. As a world author, I want the panel's search to still work across every group, including locations, so that I can find an opening by its text.

### Collapsible opening cards

47. As a world author, I want each opening card to collapse to one line, so that a long list stays scannable.
48. As a world author, I want a collapsed card to show its drag handle, "Opening N", its first line, both switches, weight, chance and delete, all live, so that I can reorder and tune without expanding.
49. As a world author, I want to drag collapsed cards to reorder them, so that reordering a long list is short.
50. As a world author, I want a collapse-all / expand-all control in the header, so that I can get the list into one known state in one click.
51. As a world author, I want a list of three or more openings to open collapsed and a shorter list to open expanded, so that the default fits what I'm likely doing.
52. As a world author, I want a newly added opening to open expanded, so that I can write it at once.
53. As a world author, I want collapse state never saved, so that nothing about the view changes my world file.
54. As a world author, I want placeholder value cards to follow the same open-state rule, so that the two editors behave the same way.

### Fixes

55. As a world author, I want the Player Action | Narration control and the new Others | Self control to fit their selected value inside the track, so that the control reads cleanly.
56. As a world author, I want Openings to be the last tab on an entity, in both entity editors, so that the tab order matches locations.

### SillyTavern import

57. As a player importing a SillyTavern card, I want its first message and alternate greetings to import as Others Narration openings, so that the character greets me as its author intended.
58. As a player importing a SillyTavern persona backup, I want the import to work as it did, so that nothing about personas changes on import.

### Test Bench

59. As a world author, I want to pick a persona in the Test Bench's opening view, so that I can preview which Self openings draw.
60. As a world author, I want the Bench's opening view to include location openings at the picked start, so that its preview matches play.

## Implementation Decisions

### Shape

- An **Opening** gains an optional flag that marks it Self. Absent means Others. No migration: every shipped opening reads as Others.
- A **location** gains `openings` and `openingWeights`, with the same shape and weight semantics as the world's and an entity's. Locations get no switch of their own; the world switch governs them.
- ⚠️ Both are export-shape changes (world exports, entity character cards, published listings). The user decides any version bump.

### Pool rule

The opening pool module stays the one owner of the draw. Its sources gain the resolved persona (world or library entity, or None), the Custom Persona entity and the world's locations. The rule, in order:

1. The world Openings switch is off → empty pool (default opening). An explicit off always wins. With the switch absent, the derived switch turns on for any drawable world-owned row, or for the played library persona's drawable Self rows (Q25). Library Additions never turn it on.
2. **Self rows:** the played entity's Self openings. Under a library persona with none, the world's Custom Persona entity's Self openings. Under None, the Custom Persona entity's Self openings. A saved persona reference that no longer resolves counts as None here, the same as the rest of play (Q26). A world persona must carry the Persona mark; a world persona with no Self rows falls through. Non-empty → the pool is these rows only.
3. **Library Additions:** their drawable openings (Others only) → the pool, as today.
4. **Location pool:** the world's openings, the start location's own openings (exact id match), and the Others openings of cast entities present at the start.

- Self rows never join a location pool. Others rows of the played entity never draw (current behavior).
- A persona-only entity's Others rows never draw (trait-links Q80 stands for Others). Its Self rows draw when it is the pick. Amend trait-links Q80 and its story to say so.
- Weights are keyed by owner plus opening id, as today. Location owners need their own owner key kind so an entity and a location with the same id can't collide.
- The page-one redraw and the no-repeat list read the same pool, unchanged.

### Editor view

- The editor view module takes a filter value: All Locations or a start id. Under All it returns every group, with null chances on every row except Self rows. Under a start it returns the World group, the start's location group and the present entities' groups, plus every group that holds Self rows (showing its Self rows only when the owner is absent at that start).
- Self rows carry a chance within their owner's drawable Self set, at every filter value.
- Self rows of an entity without the Persona or Custom Persona mark are omitted from the view.
- The view reports, per start, whether its location pool is empty. The panel shows the default opening card at a picked start with an empty pool, and under All lists the starts whose pool is empty. No empty start → no card.
- Group order: World, Locations (location editor order), Entities (cast order).
- The **Chances At** control is replaced by **Starting Location** with options **All Locations** then each starting location. It shows only when the world has more than one starting location; with one, the panel shows chances as at that start but filters nothing, so openings outside its pool show a dash and keep their No Starting Location badge (Q29). The "Not at X" hint is removed.
- A location with openings that isn't a starting location gets the No Starting Location badge, as entities do.

### Owned rows

- The Others | Self switch uses the same segmented control as Player Action | Narration. It shows on world entities with the Persona mark, on the Custom Persona entity, and on library entities with the Persona mark. It never shows on the world's own openings or on location openings.
- Flipping either switch changes only that field.
- The owned group's add button reads "Add Opening to <owner>" as its visible text.

### Collapse

- A shared collapse-state module owns: per-card open state keyed by row id, the open-on-mount rule (three or more rows → all collapsed; fewer → all expanded), a new row opening expanded, and collapse-all / expand-all. No persistence anywhere.
- The placeholder values editor and the opening cards both use it. The placeholder editor changes its open-on-mount default to match.
- A collapsed opening header shows the drag handle, "Opening N", the first line of the text with an ellipsis, both switches, weight, chance and delete. Every control stays live, and dragging works collapsed.

### Tabs

- Entity editors (world and library) move **Openings** to the last tab.
- The location editor gains an **Openings** tab as its last tab. It shows in the same editor mode as the entity Openings tab.

### Segmented control

- Fix the control's sizing so the selected value's pill stays inside the track in the opening card header. The fix belongs to the shared control, not a local override, if the shared control is the cause.

### SillyTavern

- The card importer is unchanged in behavior. Greetings import as Opening Narration with no Self flag (Others).
- The ST persona backup import is unchanged; it carries no greetings.

### Test Bench

- The opening lens takes a persona pick beside its start pick and draws through the same pool rule, so Self rows and location rows preview as play draws them.

## Testing Decisions

A good test drives a public seam with plain world data and asserts what the author or player would see: which openings can draw, what the panel shows, what the import writes. It never asserts internal state or mirrors the pool rule inside the test.

- **Draw seam:** the new-game draw function (persona pick + world entities + locations + Library Additions + start → draw). Cover every step of the pool rule: switch off; world persona Self replaces; world persona without Self falls through; played persona's Others excluded; persona-only Self draws, Others don't; library persona Self; library persona without Self falls back to Custom Persona Self; None uses Custom Persona Self; Self beats Library Additions; location openings join at the exact start and not at a child; Self excludes location rows; an unmarked entity's Self rows never draw; entity and location owners with one id don't collide in weights or the no-repeat list. Prior art: the existing new-game opening and opening pool suites.
- **Editor seam:** the World Details component suite. Cover the filter default and options, chances hidden under All, filtering at a start, Self rows under every filter with their own chances, group order, default card cases, owned add-button text, hidden Self rows on an unmarked entity, and collapse (open-on-mount rule, new row expanded, collapse-all, drag and weight edit while collapsed). Prior art: the existing Openings tests in that suite.
- **Entity and location tabs:** the entity editor and location manager component suites cover tab order, the switch's visibility rule and a flip keeping text.
- **Placeholder collapse:** the placeholder manager suite covers the new open-on-mount rule.
- **SillyTavern:** the card importer suite pins that greetings arrive as Narration openings with no Self flag.
- **Test Bench:** the opening lens suite covers the persona pick and location rows.
- **Migration net:** a world with openings and no Self flag loads and draws exactly as before.

Each guard is proven by reinstating the bug it catches (for example, letting Self rows join the location pool must fail the draw seam).

## Out of Scope

- Changing what the AI reads for a Self opening. It renders and sends exactly like any opening.
- A per-persona Self switch or per-location enable switch.
- Location openings on non-starting locations drawing through travel or any mid-game event.
- Showing the player which opening was drawn, or letting them choose one.
- Blueprints Q74's wider ask (world text reading the played persona's copy) beyond openings.
- Persisting collapse state.

## Further Notes

- Rulings from the grill, in order: Q1 one spec; Q2 per-opening switch; Q3 Self replaces the pool; Q4 location openings join; Q5 filter defaults to All Locations; Q6 library personas carry Self; Q7 owned add button names its owner; Q8 persona-only Self draws, Q80 amended for Others only; Q9 switch on persona entities only, flips never erase, unmarking keeps the flag; Q10 Self rows in the owner's group with own chances under every filter; Q11 one world switch; Q12 exact start only; Q13 location tab plus mirrored group; Q14 World, Locations, Entities; Q15 Self beats Library Additions; Q16 unmarked entity's Self rows hidden; Q17 default card only where it can draw; Q18 Bench persona picker; Q19 labels Others | Self; Q20 filter label Starting Location; Q21 collapse rule shared with placeholders; Q22 collapsed header keeps every control; Q23 ST import stays Others Narration; Q24 Custom Persona carries Self under None and under a library persona with none; Q25 a played library persona's drawable Self rows turn on an absent (derived) world switch, an explicit off still wins, and Library Additions never turn it on (ticket 04 intent answer, from story 15); Q26 an unresolved persona reference draws as None, so the Custom Persona's Self rows apply (derived from "a save whose persona no longer exists plays with none"); Q27 a world with no locations shows every group unfiltered with no picker: world rows show their chance, other Others rows a dash with the No Starting Location badge, Self rows their own share, and the default card shows unnamed when the world's own pool is empty (ticket 06); Q28 the default card ignores the world switch, as chances do, and the switched-off hint covers the off case (ticket 06); Q29 a lone start shows its chances but filters nothing, since with no All Locations option a filter would hide unreachable openings and their badge for good (ticket 06, from stories 27 and 31).
- The forum report behind this effort: a player picked a persona and got another persona's opening. Q3 fixes that report.
- Blueprints Q74 tabled "an entity opening read as the selected persona" as a separate effort. This spec is that effort for openings.
- Glossary: add **Self Opening** and **Others Opening** to the Opening entry in the domain glossary, and note that a location can own openings.
