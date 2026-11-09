# Spec: Openings Tab

Status: ready-for-agent
Spec session: openings-tab — spec

## Problem Statement

A world's openings live on the Overview tab's Openings sub-tab, which shows every opening in one long scroll: the world's own, then each location's, then each entity's. A world with many openings becomes a wall of text. To add an opening to an owner, the author scrolls to the end of that owner's group. To give a new location or entity its first opening, the author has to leave and open that owner's own Openings tab. On top of that, a separate "Use These Openings" checkbox can turn written openings off, so a world can hold openings that never draw.

## Solution

Openings becomes its own World Editor tab, right after Overview, in Advanced mode. It uses the editor's list-and-detail layout:

- **The list** shows "This World" pinned first, then a Locations section and an Entities section with only the owners that have openings. Each row shows the owner's name, its opening count, and the No Starting Location badge when its openings never come up.
- **The detail pane** shows the selected owner's openings, with an **Add Opening** button in its toolbar and a link to the owner's own tab.
- **The + button** drills through the locations and entities that have no openings yet, in their own nesting. A pick adds a blank opening to that owner and selects it.
- **Search and the Starting Location filter** sit at the top of the list and apply to every owner.

The on/off setting goes away. A world uses its openings whenever it has any.

## User Stories

1. As a world author with many openings, I want openings in their own tab, so that I can work on them without scrolling past everything else.
2. As a world author, I want the Openings tab right after Overview, so that I find it with the world-level setup.
3. As a world author in Simple mode, I want no Openings tab, so that the editor stays as simple as it is today.
4. As a world author, I want a list of the owners that have openings, so that I see at a glance where openings are written.
5. As a world author, I want "This World" always first in the list, so that the world's own openings are one click away even before I write any.
6. As a world author, I want the default-opening note in This World's pane, so that I know what players get when no opening can draw.
7. As a world author, I want locations and entities in their own sections, in the same order as their own tabs, so that the list reads like the rest of the editor.
8. As a world author, I want each row to show how many openings it holds, so that I can spot the owners with many or few.
9. As a world author, I want a No Starting Location badge on a row whose openings never come up, so that I notice dead openings without opening each owner.
10. As a world author, I want to select an owner and see only its openings, so that I edit one owner at a time.
11. As a world author, I want an Add Opening button at the top of the selected owner's pane, so that I add an opening without scrolling to the end of a long list.
12. As a world author, I want a + button that drills through my locations and entities, so that I can give a new owner its first opening from this tab.
13. As a world author, I want the + picker to use the same nesting as the Locations and Entities tabs, so that I find an owner where I put it.
14. As a world author, I want the + picker to list only owners without openings, so that it never offers one already in the list.
15. As a world author, I want a pick from the + picker to add a blank opening and select that owner, so that I can start writing at once.
16. As a world author, I want an owner to stay in the list after I delete its last opening, until I select another owner, so that an undo or a new opening keeps me in place.
17. As a world author, I want an owner with no openings to leave the list once I move on, so that the list holds only owners with openings.
18. As a world author, I want search to filter owners by their name or by their opening text, so that I find an opening when I remember only a phrase from it.
19. As a world author, I want the selected owner's pane to show only the matching openings while I search, so that the match is on screen.
20. As a world author with several starting locations, I want a Starting Location filter at the top of the list, so that I see only the owners whose openings can come up at that start.
21. As a world author, I want a link from an owner's pane to that location or entity, so that I can jump to the rest of its setup.
22. As a world author, I want entities and locations to keep their own Openings tab, so that I can still write an opening while I work on that owner.
23. As a world author, I want an edit on either tab to show on the other, so that both views stay true.
24. As a world author, I want my openings to draw whenever my world has any, so that I never ship openings that silently do nothing.
25. As a world author with an old world whose openings were switched off, I want those openings to draw now, so that the world behaves the same as every other world.
26. As a world author, I want the Overview tab to drop its Openings sub-tab, so that openings have one home in the editor's tab strip.
27. As a world author, I want Find to open the Openings tab on the owner that holds a match, so that the match is on screen.
28. As a world author, I want undo and redo of an opening edit to open the Openings tab on that owner, so that I see what changed.
29. As an author using the help window's Take Me There, I want an openings link to open the Openings tab, so that I land on what the help describes.
30. As a player, I want a world's openings to draw as the author wrote them, so that the first page is the one they intended.

## Implementation Decisions

- **Rulings.** Q1: Openings is a top-level World Editor tab; the Overview right column loses its Openings tab. Q2: "This World" is a pinned first row, always present. Q3: a pick from the + picker adds a blank opening to that owner and selects it. Q4: search filters owners by name or opening text, and the pane shows only matching openings. Q5: entities and locations keep their own Openings tab. Q6: the tab is ungrouped, after Overview (Overview, Openings, Media). Q7: the + picker lists only owners with no openings. Q8: under This World, a Locations section then an Entities section, each in its own tab's order and nesting. Q9: the "Use These Openings" setting is removed; a world with any authored opening uses its openings. Q10: load ignores a stored off flag, and the field is dropped from the world. Q11: each row shows its name, its opening count and the No Starting Location badge. Q12: an owner whose last opening is deleted stays listed until another row is selected. Q13: the Starting Location filter sits at the top of the list with search and +. Q14 (prototype, variant B "Nested Tree"): the owner list follows the real nesting, with no section headings. Locations come first in the location tree, then entities in their folder tree, separated by a rule. A parent location or entity folder that holds no listed owner but contains one shows as a dim row that can't be selected. Each owner row shows its count on the right and the No Starting Location icon when that applies. In the + picker, a location with pickable sub-locations only opens its level; inside that level, an "Add to <name>" row at the top adds the opening to the location itself. A location without pickable sub-locations is a plain pick row. This settles the pick-and-level question that Further Notes left open. Q15 (ticket 01): with nothing selected, the tab selects This World on desktop; mobile opens on the list. Q16: when search or the filter hides the selected owner's row, the selection and its pane stay, and the pane shows "No openings match" when search finds none. Only a delete or the Q12 next selection moves to This World. Q17: a row's count follows the Starting Location filter (the rows the owner shows at that start) and ignores search. Q18: This World's pane ends with the world panel's closing hint, and a location's or entity's pane ends with the hint its own Openings tab shows. Ticket 04 rewrites the on/off wording. Q19 (ticket 02): the + menu holds only the Location and Entity drill-ins. It keeps the "Add to Openings" name that every menu + uses ("Add to Locations"). Q20: the picker offers exactly the owners the tab's list would not show with no search and no filter, so every owner is reachable from one or the other. An entity whose only openings are hidden Self rows is pickable. The picker ignores search and the filter, and a pick clears the typed search. Q21: with nothing to pick, the + stays enabled and opens on two disabled rows. Q22 (ticket 03): undo and redo reveal the place the edit was made, as every History Origin does. An edit on the Openings tab reveals that tab on its owner. An edit on an entity's or location's own Openings tab reveals that tab. Editor history is per visit and never saved, so no Overview Openings origin outlives ticket 03 and no mapping for one is written. Ticket 03's "wherever the edit was made" means from whatever tab the author is on now. Q23: ticket 03 removes only the checkbox. The flag, its readers, the entity-copy toast and the docs that describe the flag stay for ticket 04; the gap between the two landings is accepted. Both help baseline cases that name the Overview surface for openings move to the Openings tab.
- **Tab ledger.** The World Editor tab list gains an Advanced-only Openings tab with no group, between Overview and Media. Simple mode never shows it. The dev-router ledger gains the tab.
- **Overview.** The Overview right column keeps Details and Custom Prompts. Its Openings tab, the "Use These Openings" checkbox and the Openings value of the Overview place go away.- **The list.** It follows the editor's list-and-detail tabs (Locations, Entities). It is built from the existing openings editor view, which already groups openings by owner and knows each owner's No Starting Location state and the starts filter. The count is the number of openings the owner holds as listed in its group today, Self rows included where that group shows them.
- **The + picker.** It sits in the list toolbar's + menu, with two drill-ins: one for locations by their parent nesting, one for entities by their folders. It reuses the Owner Flyouts pattern (one level at a time, Back row, folder rows with a chevron). Owners with openings are not listed, and a level with no pickable owner below it has no row. A location that has sub-locations is both a pick and a level; how that row reads is a design question for the build (see Further Notes).
- **Add Opening.** It sits in the detail pane's toolbar for every owner, This World included, and adds a blank opening at the end of that owner's list. Each owner's add button at the end of its group goes away on this tab.
- **Selection.** The selected owner is editor state for the session, like the other list tabs. An owner whose last opening is deleted stays listed while selected and leaves the list on the next selection. If the selected owner is deleted or leaves the list, This World is selected.
- **Search and filter.** One search box for the tab. An owner row matches on its name or on the text of any of its openings, through the existing list-search matching for openings. The Starting Location filter shows only when the world has more than one start, as today.
- **On/off removed.** Whether openings apply depends only on whether any owner has an authored opening. The stored flag is ignored by the draw and stripped by world migration on load, so a saved world no longer carries it. The hints that describe openings being off go away. The entity and location Openings tabs keep their own hints, rewritten where they mention turning openings on.
- **Find, undo and Take Me There.** An opening field key opens the Openings tab on its owner. Undo and redo of an opening edit reveal the Openings tab on that owner. The help window's openings route points at the new tab.
- **Copy.** Tab name: Openings. Button: Add Opening. All other labels and hints are written per the Writing Guide at build time.
- **Export shape.** The world `.json` loses `openingsEnabled`. It shipped in 3.0.1. Older builds read a missing flag as on, so a world saved by this build plays the same in an older one. Save files do not change.

## Testing Decisions

- **Seam 1: the World Editor bench.** Every tab test drives the real editor and reads what is on screen: which rows the list shows, which row is selected, which openings the pane shows, and what the + picker offers.
- **Seam 2: the existing openings and world-migration unit tests.** They check that a stored off flag no longer blocks the draw, and that migration strips it and stays idempotent.
- **A good test here** asserts what the author or the draw sees. It never asserts on component props, history entry shapes or internal state.
- **What to cover.**
  - The tab shows in Advanced mode only, between Overview and Media. Overview no longer shows an Openings tab.
  - This World is listed with no openings anywhere. Owners without openings are not listed. Rows show the count and the badge.
  - The + picker lists only owners without openings, in their nesting. A pick adds one blank opening, lists the owner and selects it.
  - Add Opening adds to the selected owner, This World included.
  - Deleting the last opening keeps the row until another row is selected.
  - Search filters rows by name and by opening text, and the pane shows only matching openings. The filter narrows rows to a start.
  - An edit on the new tab shows on the owner's own Openings tab.
  - Find on an opening match and undo of an opening edit each land on the Openings tab with that owner selected.
  - A world with authored openings and a stored off flag draws an opening.
- **Guards must bite.** For Find, undo reveal, the picker's exclusion and the flag removal, reinstate the bug and confirm the right test fails.
- **Prior art.** The Locations and Entities tab bench tests, the Overview panel and history-reveal bench tests, the openings panel tests, and the openings and migration unit tests.

## Out of Scope

- Any change to how an opening draws, its weight, or the Self and Others rules.
- The entity and location Openings tabs, beyond their hint copy.
- Library entities' openings editor.
- The Overview tab's left column.
- Reordering owners or moving openings between owners from the new tab.

## Further Notes

- This supersedes the overview-right-tabs spec's Openings tab and its "Use These Openings" checkbox (that spec's Q3 for openings).
- The prototype is on the `prototype/openings-tab` branch, commit `d71257547`. It shows three variants on the real editor with `?variant=A|B|C` and a dev-only switcher bar. B won (Q14). Start it with `npx vite --port 5320 --strictPort --force` in that worktree. It is a reference only: rebuild the winner properly, without its switcher.
- The "Add to <name>" picker row and the dim context rows are new variants of the Owner Flyouts and list patterns. The user approved them through the prototype, so the build documents them in the Design System.
- No bundled world stores the off flag, so no bundled world changes behavior.
