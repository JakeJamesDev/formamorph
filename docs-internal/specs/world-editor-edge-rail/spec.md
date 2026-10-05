# World Editor Edge Rail

Status: ready-for-agent
Spec session: world-editor-edge-rail — spec
Status note: Settled by prototype. Branch `prototype/world-editor-tabs` (worktree `.claude/worktrees/prototype-world-editor-tabs`, launch entry `proto-world-editor-tabs`, port 5245, open `/?variant=E#dev?modal=worldEditor`). Rounds: a06bc057 (A side drawer, C icon strip, D overflow menu), 80090132 (B grouped rows, inner rail, G captioned strip), 45aeac43 (E edge rail, F menu bar, H group rail), 1f3955e9 (F on hover), fdc2f52c and 47bcdfe1 (help button and List/Canvas). E won.

## Problem Statement

The World Editor's top-level tabs sit in one horizontal strip inside the list card: Overview, Stats, Entities, Locations, Traits, Dictionary, and Placeholders in Advanced mode. The strip shares the card's width with the detail pane beside it, so at the half-pane widths an author works in the labels already run tight. Two more tabs are coming (Scripts and Tools) and the strip has no room for them. The `?` help button lives at the right end of the row above the list; on Overview, which has no list, that row holds only the `?`, a full row for one button. On Locations, the List and Canvas switch sits between the `+` and the search box with text labels, pushing the search narrower.

## Solution

The tab strip leaves the card. A full-height **edge rail** sits on the editor's outer left edge, left of both cards, one icon per tab. Tabs are grouped (World, Text, Logic) with a separator between groups. Hovering or focusing an icon flies out a label that names the group and the tab, "World · Entities". The active icon carries an accent bar. The rail has no expanded state and no toggle; the list card keeps its full width.

The `?` moves into the header row, right of Find. Overview loses its empty toolbar row. On Locations the List and Canvas switch becomes two icons with tooltips and sits after the search box, at the row's right end.

Mobile drops the horizontal strip for the disclosure bar the Enter World flow uses for its collapsed Categories: a full-width bar under the header that names the current tab and a chevron, and expands the grouped tab list below it. The `?` moves to the header there too. The header's back arrow loses its outline, and the header's icon buttons never shrink, so Find stays square.

## Rulings

| # | Ruling |
|---|---|
| Q1 | Desktop navigation is an edge rail on the editor's outer left edge, outside every card, full height, icons only. The horizontal strip inside the list card goes |
| Q2 | Tabs are grouped: **World** (Overview, Stats, Entities, Locations, Traits), **Text** (Dictionary, Placeholders), **Logic** (reserved for Scripts and Tools). A separator draws between groups. A group with no visible tab draws nothing, so Logic is absent until a tab exists in it. Simple mode hides Placeholders as today, so Text shows Dictionary alone |
| Q3 | Hovering or keyboard-focusing a rail item flies out a label reading "Group · Tab". No expanded state, no collapse toggle, no stored preference |
| Q4 | The active item carries a primary accent bar on the rail's edge and foreground color; the rest are muted. Every item has an accessible name equal to its tab label |
| Q5 | The rail is a real tab list: one tab root wraps the rail and the cards, the rail is its vertical list, each icon a tab trigger, and the tab panels stay in the list card. Arrow keys move along the rail as they do along the strip today |
| Q6 | Superseded by Q12. The rail is desktop-only |
| Q7 | The `?` help button moves to the header row, right of Find, on desktop and mobile. The row above the list no longer carries it. Overview, which has no list, renders no toolbar row at all |
| Q8 | On Locations, the List and Canvas switch is two icons with tooltips ("List", "Canvas") on desktop as on mobile, and sits after the search box at the row's right end. The `+` stays beside the search box it feeds |
| Q9 | While the Test Bench is embedded in the list card the rail stays drawn and disabled, as the strip is absent in that state today. The Bench's own tabs are untouched |
| Q10 | Scripts and Tools are not part of this effort. The prototype's placeholder tabs stay on the branch. The group registry ships the Logic group so their specs add one line each |
| Q11 | The edge rail is a new Design System pattern, documented with the showcase before adoption. Rejected on the way: a collapsible drawer inside the card, an icon-over-label strip, a five-plus-More overflow strip, a group row over a sub-tab strip, a captioned one-row strip, and a hover menu bar (F), which stays on the branch as the fallback |
| Q12 | Mobile navigation is the Enter World flow's collapsed Categories widget: a full-width disclosure bar under the header with a tree icon, the label **Sections**, the current tab's name at the right, and a chevron that turns when open. Opening it expands the grouped tab list below the bar with the same grid-rows transition and `inert` while closed; picking a tab closes it. The horizontal scrolling strip goes. Replaces Q6's strip |
| Q13 | The World Editor's back arrow draws with no outline: a plain ghost icon. Every icon button in the header row keeps its square size and never shrinks, on both layouts, so Find is never squeezed when the row gets tight |
| Q14 | One changelog line for the effort. Every ticket's fragment carries the exact lead **The World Editor's tabs move to an icon rail on the window's edge.** and its own sentence after it; the first to land creates the line and the rest fold in. Ticket 03's sentence: "On Locations, List and Canvas are icons with tooltips at the right end of the search row." |

## User Stories

1. As a world author, I want the editor's tabs on a rail at the window's edge, so that the list card keeps its full width beside the detail pane.
2. As a world author, I want one icon per tab, so that nine tabs fit at every pane width without labels truncating.
3. As a world author, I want the tabs grouped with separators, so that the rail reads as World, Text, and Logic rather than nine unrelated icons.
4. As a world author, I want a label to fly out when I hover an icon, so that I never have to guess what an icon means.
5. As a world author, I want the flyout to name the group as well as the tab, so that the grouping is readable even though the rail shows no captions.
6. As a world author, I want the active tab marked with an accent bar, so that I see where I am at a glance.
7. As a keyboard author, I want the rail to be a tab list, so that arrow keys move between tabs and focus shows the flyout.
8. As a screen-reader author, I want each rail item named by its tab, so that the rail reads as the strip did.
9. As a world author in Simple mode, I want Placeholders hidden as before, so that the mode switch still hides what it hid.
10. As a world author, I want an empty group to draw nothing, so that the rail never shows a separator with nothing under it.
11. As a world author, I want the `?` in the header beside Find, so that help has one fixed place on every tab.
12. As a world author on Overview, I want no empty row above the form, so that the form starts under the header.
13. As a world author on Locations, I want List and Canvas as icons with tooltips, so that the search box gets the width the labels took.
14. As a world author on Locations, I want the view switch at the right end of the row, so that the `+` stays next to the search it feeds.
15. As a mobile author, I want the tabs behind one Sections bar that names where I am, so that the tab list takes no room until I ask for it.
16. As a mobile author, I want the `?` in the header too, so that help is in the same place on both layouts.
25. As a mobile author, I want the Sections bar to work like the Categories bar in Enter World, so that one disclosure pattern serves both screens.
26. As a world author, I want the back arrow to be a plain icon, so that the header's square buttons have room and Find is never squeezed.
17. As an author using the Test Bench embedded, I want the rail to stay in place but inactive, so that the editor's own tab state is not changed behind the Bench.
18. As an author following the Authoring Tour, I want each step to still open its tab, so that the tour works unchanged on the rail.
19. As an author using Find, I want a match to still open its tab, so that search navigation works unchanged.
20. As an author using Take Me There, I want the route to Find still to land, so that help routes keep working.
21. As a developer, I want the tab registry to carry each tab's group and icon, so that a new tab is one line and the dev-router guard still checks the list.
22. As a developer, I want the rail as its own component with tests, so that its structure is checked without the whole editor.
23. As a developer, I want the editor tests that select a top-level tab by role to keep passing, so that the change is a layout change and not a test rewrite.
24. As a Design System reader, I want the edge rail documented with a showcase entry, so that the next rail is built the same way.

## Implementation Decisions

### Tab registry

- Each tab in the World Editor's tab registry gains a group id and an icon. The registry exports the groups in order (World, Text, Logic) with a label and the tabs one editor mode shows, and a helper that returns the groups for a mode with their visible tabs, dropping empty groups (Q2).
- The dev-router ledger guard keeps checking the tab list against the registry. Nothing in the dev-router changes.

### Edge rail component

- A new component under the editor components: it takes the grouped tabs for the current mode and renders the vertical tab list with a separator between groups and one trigger per tab (Q1, Q2, Q5).
- Each trigger renders the icon and a flyout label that is hidden until hover or focus-visible, reading "Group · Tab" (Q3). The flyout is positioned beside the rail and never takes pointer events.
- Active state: an accent bar on the rail's edge and foreground color (Q4). The trigger's accessible name is the tab label.
- The rail accepts a disabled flag for the embedded Bench state (Q9).
- Icons, one per tab, from the shared icon library; the prototype's set is the starting point (Overview globe, Stats column chart, Entities users, Locations map pin, Traits sparkles, Dictionary open book, Placeholders braces).

### World Editor assembly

- Desktop: the tab root wraps the rail and the panel group. The rail is the tab list; the list card holds the toolbar and the tab panels, with no strip (Q1, Q5). The rail is a sibling before the panel group, so the panel group's own panels and the Bench and In Play panels are unchanged.
- Mobile: a **Sections** disclosure bar under the header, built from the same pieces as Enter World's collapsed Categories bar (the trigger with tree icon, label, current name and turning chevron; the grid-rows reveal with `inert` while closed). Its body is the grouped tab list from the same registry, with group captions; picking a tab closes the bar (Q12). The pieces move to a shared component so both screens render one widget.
- Header row: the back arrow is a ghost icon with no border; every icon button in the row is `shrink-0` so it keeps its square size (Q13).
- Header row: the `?` renders right of Find, on both layouts (Q7). The help topic still follows the active tab; the remount-per-topic rule for the nudge stays.
- The row above the list is the List Editor's toolbar alone; a tab with no List Editor renders no row (Q7).
- Locations: the List and Canvas switch renders icon-only with tooltips on both layouts and is passed to the toolbar's trailing slot, after the search box (Q8). The mobile-only branch for icons goes.
- Embedded Bench: the rail stays drawn and disabled (Q9).

### Docs and Design System

- The World Editor guide's note that the `?` sits at the right end of the row above the list changes to the header row, right of Find. The guide's tab wording changes from a strip to the rail where it names the strip.
- The Design System guide gains "Pattern: Edge Rail" with the showcase entry, documented before adoption (Q11).
- Changelog fragment: one Minor Added entry under 👤 for the rail, the `?` move and the Locations switch. Every ticket writes the same bold lead, **The World Editor's tabs move to an icon rail on the window's edge.**, plus its own sentence; prepare folds them onto one line in landing order (Q14).

## Testing Decisions

A good test calls the public seam with real inputs and asserts what an author would see. It never reads internal state or mirrors the component's class list.

- **Tab registry (existing seam).** Groups for Simple hold World with five tabs and Text with Dictionary; Advanced adds Placeholders; Logic is absent in both; the dev-router guard still matches the registry. Prior art: the dev-router test.
- **Edge rail (new seam).** Renders a tab per visible tab with the tab's name; a separator between groups and none after the last; the active trigger is selected and carries the accent marker; hovering or focusing a trigger shows "World · Entities"; clicking a trigger calls the change handler; disabled renders every trigger disabled. Prior art: the panel tab strip tests.
- **World Editor (existing harness).** On desktop the top-level tab is found by role in the rail and the list card has no tab strip; the `?` is in the header row after Find; Overview renders no toolbar row; Locations' toolbar has List and Canvas as icon buttons named by their tooltips after the search box; selecting a rail tab shows that tab's list. The existing tests that select a top-level tab by role keep passing unchanged. Prior art: the list toolbar test and the landing tests.
- **Sections bar (new shared seam, through both hosts).** Closed: the bar names the current tab and its body is inert; opening lists the grouped tabs; picking one shows that tab and closes the bar; Enter World's Categories bar renders through the same component and its existing tests pass. Prior art: the Enter World workspace tests.
- **Header row (existing harness).** The back arrow has no border class; Find keeps its square size with the row at 375px.
- **Guards bite.** Reinstate once: render the Logic group with no tabs and the empty-group test must go red; put the `?` back in the toolbar and the header test must go red.

## Out of Scope

- Scripts and Tools themselves (Q10).
- Any change to the Enter World flow's own Categories bar beyond extracting the shared widget (Q12).
- A collapsible or expanded rail state, or a stored rail preference (Q3).
- The Test Bench panel, its tabs, and the In Play pane.
- Changes to help topics, Find, the Authoring Tour steps, or Take Me There routes beyond keeping them green.
- The detail pane's panel tab strips (entity, location, stat, trait).

## Further Notes

- The prototype's rail used plain buttons because its tab root could not span the panel group; the real build wraps the root around both so the rail is a true tab list (Q5) and the test harness's tab lookup keeps working.
- The prototype moved the `?` for both layouts, so the mobile header with Find, the Bench flask, Simple/Advanced and the `?` has been seen at 800px only. Check it at phone width during the build.
- The hover menu bar (F) is the fallback if the rail's icon-only form proves hard to learn. It lives on the prototype branch at `?variant=F`.
