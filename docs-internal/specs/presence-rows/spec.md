# Spec: Presence Rows

Status: ready-for-agent
Spec session: presence-rows — spec

## Problem Statement

A location's Presence tab lists the entities that can be there, but the list is read-only. The only control is a multi-select that adds and removes Generic entities. A Unique entity cannot be added, changed or removed from the location side. To change why an entity is at a location, the author must leave the Locations section for that entity's Routine tab.

The Locations Canvas can draw an entity's routine and its Known In marks, but only in full screen, through the entity card. The canvas beside the location panel draws nothing for an entity. So an author who reads "Warden begins here (50%)" on the Presence tab cannot see where else Warden goes without opening full screen and picking Warden again.

## Solution

The Presence tab's Entities Here becomes a list the author can select from. Each entity that can be at the location is one row: its name and the reasons it can be here. Selecting a row shows that entity's editor in one region under the list. The editor is the body of the canvas entity card: the Routine editor and Known In.

The selected entity is also picked on the canvas beside the panel. The canvas draws its routine or its Known In marks, the canvas key and a status line, as full screen does. Beside the panel the map only shows the routine. A click on a location still selects that location.

An Add Entity select under the list adds any entity, Unique or Generic. The Generic multi-select goes.

## User Stories

1. As an author, I want each entity that can be at a location listed as a row on the Presence tab, so that I see the whole cast of that location.
2. As an author, I want each row to show the reasons the entity can be here, so that I know why it is listed.
3. As an author, I want a Unique entity's chance to begin here shown in its row, so that I can judge how often it starts here.
4. As an author, I want to select a row, so that I can change that entity without leaving the location.
5. As an author, I want the list to stay where it is when I select a row, so that I do not lose my place in a long list.
6. As an author, I want the selected row marked, so that I know which entity the editor under the list belongs to.
7. As an author, I want only one entity selected at a time, so that the editor and the canvas always show the same entity.
8. As an author, I want no row selected when I open the tab, so that the tab opens as a short list.
9. As an author, I want to close the selected entity, so that the canvas goes back to the Connections.
10. As an author, I want the editor under the list to be the same Routine editor as on the entity panel, so that I learn one editor.
11. As an author, I want a Routine and Known In switch in that editor, so that I can change either from the location.
12. As an author, I want the editor to open on the first Start that names this location, so that I see the part of the routine that puts the entity here.
13. As an author, I want each Start that names this location marked, so that I can find the others.
14. As an author, I want each routine row that names this location marked, so that I can see which row brings the entity here.
15. As an author, I want an entity that is here only through Can Also Go to open with that list in view and the location marked there, so that I see why it is listed.
16. As an author, I want the canvas beside the panel to draw the selected entity's routine, so that I see where else it goes.
17. As an author, I want the canvas key to show while a routine or Known In marks are drawn, so that I can read the marks.
18. As an author, I want a status line on the canvas that names the entity, so that I know whose routine is drawn.
19. As an author, I want the status line to show an entity's name as I see it elsewhere, with placeholders resolved, so that I never read a raw token.
20. As an author, I want a selected routine row to narrow the canvas to that row's locations, so that I can check one row.
21. As an author, I want Known In mode to draw the Known In marks on the canvas beside the panel, so that I can check where the entity is known.
22. As an author, I want a click on another location on the canvas to select that location as it does today, so that the canvas stays my way to move between locations.
23. As an author, I want the same entity to stay selected when I click a location it can also be at, so that I can follow one entity across the map.
24. As an author, I want the selection to clear when I move to a location the entity cannot be at, so that the canvas does not show a routine with no row.
25. As an author, I want Edit Full Screen to open the entity card on the selected entity, so that I can continue with the map tools.
26. As an author, I want the entity I picked in full screen to be selected on the Presence tab when I leave full screen, so that I do not pick it twice.
27. As an author, I want the selection to clear when I change to another tab of the location, so that the canvas shows Connections while I edit them.
28. As an author, I want an Add Entity select under the list, so that I can put any entity at this location.
29. As an author, I want the select to list only entities with no row here, so that I cannot add one twice.
30. As an author, I want a Generic entity I add to get a Start here, so that it stands here from the start of a game.
31. As an author, I want a Unique entity I add to get one more Start here, so that it can begin here without losing its other Starts.
32. As an author, I want an entity I add to be selected at once, so that I can set its routine straight away.
33. As an author, I want a remove button on a Generic entity that begins here, so that I can take it out of the location in one press.
34. As an author, I want that button disabled with the reason when the Generic entity begins nowhere else, so that I understand why it stays.
35. As an author, I want no remove button on a Unique entity, so that one press cannot delete rows of its routine.
36. As an author, I want the button that opens the entity's own Routine tab kept on each row, so that I can still go to the entity panel.
37. As an author, I want the Known Here list to stay on the tab, so that I can still see and change who is known here without being here.
38. As an author, I want an undo of an edit I made in the editor under the list to bring me back to that entity on the Presence tab, so that I see the change where I made it.
39. As an author on a narrow screen or in the list view, I want the rows and the editor to work with no canvas, so that the tab is useful everywhere.
40. As an author, I want an empty location to say that no entity can be here and still offer Add Entity, so that I can start a cast from the location.
41. As an author using a keyboard, I want to move through the rows and select one, so that I do not need the mouse.
42. As an author, I want the remove button on a Known Here row to be an icon, so that the row matches the other lists and reads faster.
43. As an author, I want the Custom Persona left out of the list and the select, as today, so that the player's own entity is never placed.

## Implementation Decisions

Rulings from the grill of 2026-11-11, renumbered for this effort.

- **Q1.** This is its own effort. NPC Schedules stays closed.
- **Q2.** A row exists for every entity the presence-line model lists today: a Unique or Generic entity with at least one reason at this location (begins here, a row names it, or Can Also Go lists it). An entity with no kind has no row.
- **Q3.** One entity is selected at a time. No entity is selected when the tab opens. (Prototype verdict, Q16; replaces "one folding row open at a time".)
- **Q4.** A list row shows the name and the reasons on one line, the reasons cut off when they do not fit, then the Open Routine button and, for a Generic entity that begins here, the remove button. The selected row has the selected-row look of the Design System. There is no chevron.
- **Q5.** Adding a Unique entity gives it one more Start at this location, weight 1, no rows. Adding a Generic entity gives it a Start here, as today.
- **Q6.** The editor region holds the canvas entity card's body unchanged: the Routine and Known In switch, the mode hint, the Routine editor or the Known In field.
- **Q7.** The Routine editor marks each Start and each row that names the location whose Presence tab holds it, and Can Also Go marks that location in its list. On selection the editor shows the first Start that names the location; with none, the first Start. The mark shows only inside the Presence tab.
- **Q8.** Only a Generic entity has a remove button. It removes the entity's Starts here. It is disabled, with the reason in its tooltip, when the entity begins at no other location. A Unique entity leaves a location through edits in its routine.
- **Q9.** While an entity is selected on the Presence tab, the canvas beside the panel draws what full screen draws for a picked entity: the routine view or the Known In marks, the canvas key and the status line. It is view-only there: no routine edit by click or drag, no drag sources. The entity card stays full screen only.
- **Q10.** A click on a location on the canvas beside the panel selects that location, as today. The entity stays picked. On the new location's Presence tab it is selected when it has a row there; with no row, the pick clears.
- **Q11.** The pick carries between the Presence tab and full screen in both directions.
- **Q12.** A change to another tab of the location panel clears the pick.
- **Q13.** One Add Entity select under the list replaces the Generic multi-select. It lists every Unique and Generic entity with no row at this location, in tree order. The added entity is selected.
- **Q14.** The Known Here list stays under the rows. Its only change is Q19.
- **Q15.** An undo or redo of an entity edit made in the Presence editor region shows the change there: when that location's Presence tab is on screen and the entity has a row, the entity is selected. Otherwise the entity's Routine tab opens, as today.
- **Q16.** Prototype verdict, 2026-11-11: variant B, a fixed list with one editor region under it. Rejected: A, folding boxes as on Connections (an open box pushes the list off screen with 12 entities), and C, a select with no list.
- **Q17.** The findings of the scripts sweep and the help-docs sweep of 2026-11-11 are not in this effort. Another session handles them after this work, because this work changes some of them.
- **Q18.** Canvas status text that names an entity uses the entity's label with placeholders resolved, never the raw name.
- **Q19.** The Remove button on a Known Here row becomes an icon button with no word. It uses the same icon as the remove button of Q8, and its tooltip and accessible name say what it removes and name the entity. Nothing else on the Known Here list changes.

Modules:

- **The pick, lifted.** The picked entity (entity, mode, the pending Picked Locations state) moves out of the canvas component into state the location panel and the canvas both read and set. The canvas gains a second notion beside "picking": it shows a pick without being a picker. Full screen keeps today's picker behavior. Beside the panel the canvas shows the pick only while the Presence tab of the selected location is on screen.
- **The card body.** The entity card's body for one entity becomes its own component, used by the card and by the Presence editor region. The card keeps its entity select and close button.
- **The Presence list.** A new component replaces the Entities Here list and the Generic multi-select. It reads the presence-line model. The model is unchanged.
- **The Routine editor's here-mark.** The Routine editor takes the location to mark as an input from its host. Without one it marks nothing, so the entity panel and the canvas card are unchanged.
- **Status text beside the panel.** The canvas status line beside the panel names the entity's routine, or the selected row, and offers no edit.
- **Reveal.** The history reveal hook gains the Presence target of Q15, in the way it already opens a Connection row.

No world or save shape changes. No engine or prompt changes.

A new visual pattern needs the user's approval before adoption. The list uses the existing selected-row look; the here-mark is new and needs that approval in its ticket.

## Testing Decisions

A good test here drives what the author does and reads what the author sees. It does not assert on component state or on which component draws a region.

- **The Presence tab, component level.** Render the location panel on a world with Unique and Generic entities. Cover: a row per presence line with its reasons; no selection on open; select, change selection, close; Add Entity for each kind and the Start it writes; the remove button, its disabled case and the reason; the here-marks on Starts, rows and Can Also Go; tab change clears the pick. Prior art: the location panel tests, the Connections tab tests, the Routine tab tests.
- **The canvas.** Cover: with a pick and the Presence tab on screen, the canvas beside the panel has the routine marks, the key and the status line; a location click selects the location and edits no routine; without the Presence tab on screen it draws no pick; full screen behaves as before. Prior art: the canvas key tests, the entity picking tests, the full-screen canvas component tests.
- **The carry.** Select on the Presence tab, enter full screen, and the card names the entity. Pick in full screen, leave, and the Presence tab has it selected.
- **The reveal.** A hook-level test for Q15, beside the existing Connection-row reveal tests, plus the case where the Presence tab is not on screen.
- **Guards must bite.** Each new guard is proven by reinstating the bug once: the view-only click, the cleared pick with no row, the disabled remove.
- No test of the prototype code.

## Out of Scope

- The scripts sweep and help-docs sweep findings (Q17), including Test Bench rules, script help text, wiki pages outside this tab, and the help vectors rebuild beyond what this effort's own doc edits need.
- Routine editing on the canvas beside the panel.
- A remove action for a Unique entity.
- Changes to the Known Here list other than its remove button (Q19).
- Changes to the entity card in full screen, other than sharing its body and the pick.
- Changes to the presence-line model or the position engine.

## Further Notes

- **Prototype.** Question: which row format for the Presence tab. Verdict: B (Q16). Branch `prototype/presence-rows` at `472467ed8`, worktree `.claude/worktrees/prototype-presence-rows`, launch entry `proto-presence-rows` on port 5313, URL `http://localhost:5313/?variant=B#dev?modal=worldEditor&tab=locations&subtab=canvas&fixture=entityPresence`. Throwaway: it marks only Starts, has no undo reveal, and its copy is placeholder text.
- The prototype showed a raw placeholder token in its own status text. That is the reason for Q18. The shipped status line names no entity today.
- This work makes two stale wiki statements true again: that an entity's place can be set from the location side, and it gives the Presence tab an editor. The wiki pages for Locations and Entities change with the tickets that land the behavior.
- Copy is written under the Writing Guide in each ticket, from a facts list. The words "Entities Here" and "Add Entity" are working labels.
