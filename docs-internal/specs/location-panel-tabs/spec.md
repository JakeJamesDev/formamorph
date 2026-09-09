# Location Panel Tabs

Status: ready-for-agent
Status note: Shape settled by prototype on branch `prototype/location-panel` (see Further Notes). Follows the entity-panel-tabs effort and reuses its tab conventions; the mobile form needs a look in context before the pattern is extended in the Design System guide.

## Problem Statement

In the World Editor, selecting a location fills the right panel with one flat column: name, the starting checkbox, three description editors, the entity roster, the connection list, placeholder pins, the background image with its tags, and the ambient sound slot. In Advanced mode that is two screens tall with nothing grouping it. The prose an author writes most sits between a checkbox and a roster, the travel rules sit between the prose and the picture, and the picture takes a screen of its own for a field that matters far less to a place than to an entity. The entity panel just moved to tabs; the location panel should follow the same idea with a grouping that fits what a location is.

## Solution

The location panel becomes a tabbed form with four tabs:

- **Details** — what the place is. Name and the starting checkbox on one row, then Player-Facing Description, AI-Facing Description, and AI-Facing Summary.
- **Presence** — who is here and where it leads. The Entities roster, then Connections.
- **Media** — the background image with its tags and Generate button, then Ambient Sound.
- **Pins** — Placeholder Pins. Advanced mode only, like the pins themselves.

The picture is demoted to Media on purpose. A location's background is a backdrop, not a portrait, so it does not earn a column beside the name the way an entity's picture does.

The tab an author picks stays picked while they move through the location tree. Find and the Test Bench still land on any field: navigating to a hit opens the tab that holds it. The list side of the Locations tab, including the Canvas view, is unchanged.

Simple mode shows Details, Presence, and Media with the Simple field set inside them: Details holds Name, Starting, and the two descriptions; Media holds the image and its Generate button.

## User Stories

1. As a world author, I want the location panel split into Details, Presence, Media, and Pins, so that I see one kind of thing at a time instead of a two-screen column.
2. As a world author, I want Name and the starting checkbox on one row at the top of Details, so that the identity line is short and the prose starts right under it.
3. As a world author, I want the three descriptions directly under the name, so that writing the place is the first thing the panel offers.
4. As a world author, I want the entity roster and the connections together on one tab, so that "who is here" and "where it leads" are edited side by side.
5. As a world author, I want the Connections list to keep its add, direction, hint, and delete controls unchanged, so that travel rules work exactly as before.
6. As a world author, I want the background image, its tags, and the Generate button on a Media tab, so that the picture does not push the prose or the roster off screen.
7. As a world author, I want the Generate with AI button directly under the picture, so that it is clear the button makes a picture and not tags.
8. As a world author, I want Ambient Sound under the picture on Media, so that everything the player senses lives in one place.
9. As a world author, I want Placeholder Pins on their own tab, so that the pin rows and their conflict notes have room.
10. As a world author, I want the tab I chose to stay chosen when I select another location, so that I can review every location's descriptions in a row.
11. As a world author, I want the panel to fall back to Details when the current tab disappears, so that switching to Simple mode while on Pins never leaves me on an empty panel.
12. As a world author using Find, I want a hit inside a description to open Details and ring the field, so that navigation still reaches text that is not on screen.
13. As a world author using Find, I want a hit in Image Tags to open Media, so that every searchable location field is reachable.
14. As a world author using Find and Replace, I want replacement to work on fields in a tab that is not showing, so that the tab split does not change what Replace covers.
15. As a world author using the Test Bench, I want Open on a location finding to land on that location with its tabs intact, so that triage flows into editing.
16. As a world author using the Canvas view, I want the detail panel to behave the same as in List view, so that the tabs do not depend on which list I am looking at.
17. As a world author, I want a trait named in a pin conflict note to still open that trait, so that the Pins tab keeps its cross-navigation.
18. As a Simple-mode author, I want three tabs, so that the panel matches the mode's promise of just the essentials.
19. As a Simple-mode author, I want Details to hold Name, Starting, and the two descriptions, so that nothing the mode hides today appears.
20. As a Simple-mode author, I want the Generate with AI button to stay available on Media, so that the tab split does not remove a feature I had.
21. As a mobile author, I want the four tabs to fit the detail view without horizontal page scroll, so that the panel works on a phone.
22. As a mobile author, I want the name row to stack with the checkbox under the field, so that nothing is clipped at 375px.
23. As a keyboard author, I want the tab strip to move focus with the arrow keys and keep the shared focus ring, so that the panel matches the entity panel and every other strip.
24. As a world author, I want the placeholder palette bar to stay above the tabs, so that inserting a chip works on every tab that has a chip field.
25. As a world author, I want the location and entity panels to use the same tab strip shape, icons on the left of labels, so that the editor reads as one tool.
26. As a developer, I want a dev-router entry for the location panel's tabs, so that a test or a session can land on Presence in one call.
27. As a developer, I want the tab layout covered by tests at the World Editor level, so that Find, Bench, and mode switching are proven against the real panel.
28. As a reviewer, I want the Design System guide's tabbed-panel pattern to cover the location panel once the mobile form is approved, so that the next list panel follows the same composition.

## Implementation Decisions

- **Tabs live in the World Editor's location manager.** The location manager renders the tab strip and its four panels. The list side, the tree, and the Canvas view are untouched.
- **Tab set and order.** Details, Presence, Media, Pins. Pins appears only in Advanced mode. The tab list is one exported constant with value, label, icon, and an Advanced-only flag, mirroring the entity panel's tab module, and it feeds both the strip and the dev-router ledger. Each tab has a leading icon and a label; the strip spans the panel width with equal-width triggers using the shared Tabs component.
- **Details composition.** At `sm` and wider, Name and the starting checkbox share one row: the name field takes the flexible width, the checkbox sits at the row end, aligned to the field's baseline. Below that, Player-Facing Description, AI-Facing Description, and AI-Facing Summary stacked with their existing AI-generate controls. Below `sm`, the checkbox drops under the name field. Summary is Advanced only, as today.
- **Presence composition.** The Entities roster, then the Connections widget, stacked. Both unchanged in behavior: the roster writes each changed entity's own membership as today; Connections keeps its add, direction, hint, and delete controls.
- **Media composition.** The image widget whole: single-slot compact box, Generate with AI button, and Image Tags. Then Ambient Sound. Image Tags and Ambient Sound are Advanced only, as today. The Generate button keeps today's visibility in both modes. This tab does not depend on the entity effort's gallery-tags split; the widget renders whole here.
- **Pins composition.** The Placeholder Pins label, its help control, and the pin rows, unchanged. The trait link in a conflict note keeps working.
- **Tab persistence.** The chosen tab survives the per-location remount for the life of the editor session and is held by the editor, in the same place and shape as the entity panel's chosen tab, so the two panels share one mechanism. When the chosen tab is unavailable, the panel shows Details.
- **Find navigation opens the owning tab.** The location manager accepts the same focus-field hint the Overview and entity panels take from Find. Field keys map to tabs: `name`, `playerDescription`, `aiDescription`, `aiSummary` open Details; `imageTags` opens Media. The tab switch happens before the existing reveal-and-ring timer runs.
- **Replace is unaffected.** Replace edits the record through the search target's writer, not the DOM.
- **Bench navigation.** Bench findings pass no tab hint and land on the persisted tab, through the same optional tab hint the entity effort adds to the editor's item navigation.
- **Dev-router coverage.** A `subtab` ledger entry for the location panel (`details`, `presence`, `media`, `pins`) guarded by the same drift test as the entity panel's entry. It coexists with the existing Locations `list` and `canvas` entry, which addresses the list side.
- **No export-shape change.** Nothing about the location record changes. This is a rendering change only.
- **Design authority.** The Tabs component and the labeled-block fields are existing patterns; the tabbed detail panel is the pattern the entity effort introduces. Desktop was approved in context through the prototype. The implementer shows the mobile form in context and, on approval, extends the guide's tabbed-panel section and showcase to cover the location composition rather than adding a second pattern.
- **Changelog.** One 👤 entry in the In-Progress bucket.

## Testing Decisions

A good test drives the real World Editor with a loadable world and asserts what an author sees and where navigation lands. It never reaches into the tab component's state.

- **One seam: the World Editor bench harness.** The existing harness that renders the editor on a world in a chosen mode is the seam, as for the entity panel. Tests select a location, click tabs, and assert on labels, on which fields are present, and on which tab is active. Prior art: the entity panel suite the entity effort lands, the Bench suite, and the find-focus suite.
- **Cases at that seam.**
  - Advanced: four tabs. Details shows Name, the starting checkbox, and the three descriptions and nothing else. Presence shows Entities and Connections. Media shows Background Image, Image Tags, Generate with AI, Ambient Sound. Pins shows Placeholder Pins with its help control.
  - Simple: three tabs. Details shows Name, Starting, and the two descriptions. Media shows the image and Generate with AI; no Image Tags, no Ambient Sound.
  - Tab persists across selecting another location, including a child in the tree.
  - On Pins, switching to Simple lands on Details.
  - Find hit in AI-Facing Description from Media opens Details and rings the field; Find hit in Image Tags from Details opens Media.
  - Bench Open on a location finding lands on the location with the persisted tab.
  - Canvas view selected: the detail panel shows the same tabs.
- **Location pin section.** The existing location-manager suite for pins keeps passing; its cases run inside the Pins tab.
- **Connections.** The existing connections suite keeps passing unchanged.
- **Dev-router.** The existing ledger drift test covers the new `subtab` entry.

## Out of Scope

- The remaining list tabs (Stats, Traits, Dictionary). Each comes as its own spec if it needs one.
- A banner or portrait treatment of the background image. Rejected by the prototype.
- Changing what the image widget shows in Simple mode.
- Any change to the location record, connections, or export shape.
- Recording the pattern in the Design System guide before the mobile form is approved.

## Further Notes

**Prototype.** Branch `prototype/location-panel`, worktree `.claude/worktrees/prototype-location-panel`, launch entry `proto-location-panel` in the main checkout's launch file (Vite on port 5192 from the worktree). Variants switch with `?variant=` and a floating bar; `?variant=L3` is the winner. Commits, oldest first:

| Commit | What it answered |
| --- | --- |
| `c2fee1c5` | Three shapes: entity-style tabs with the picture beside the name (L1), a banner strip above tabs (L2), prose-first tabs with the picture demoted to Media (L3). L3 won. |
| `ca587c54` | The first tab is named Details, not Place. |

**Why the alternatives lost.** L1 wastes its picture column: a location has one image slot, so the widget renders as the small compact box, not the gallery frame. L2 keeps the picture in view on every tab, but a backdrop is not worth permanent space above the name.

**Why "Details".** The tab holds Name, Starting, and the prose, so it is the location's own record. "Overview" collides with the editor's top-level tab, "Description" undersells Name and Starting, "Location" repeats the list tab's name, and "Place" read as vague.

**Dependency on the entity effort.** This spec assumes the entity-panel-tabs effort has landed its tab-persistence slot in the editor, its optional tab hint on item navigation, and its focus-field handling in the entity manager, and reuses all three. If it starts first, it builds those and the entity effort reuses them instead. The image widget's gallery-tags split is not needed here.

**Measurements from the flat panel** (The Veilwood in the Veilwood world, Advanced, 1600x900): panel scroll height 1752px against an 873px viewport. The winning Details tab is the tallest of the four and still fits with the summary in view.
