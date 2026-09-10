# Context Menu Grammar

Status: done
Status note: Shipped on 2026-09-08 in 6d040cf1 (guide rule), 21fa4d96 (titled sets and order), and 8b172e51 (action row icons). Synthesized the same day from a review of the Main Menu tile menu and the Locations Canvas menu.

## Problem Statement

The Main Menu tile menu looks right. The Design System guide describes its rows but never states the rule that makes it right. An agent can copy that menu from the guide. An agent cannot derive a new menu from it.

The Locations Canvas menu shows the gap. It groups its rows into sections, but no section has a title, no action row has an icon, and the Connection style rows each repeat the word "Connections" because no title carries it. It reserves an invisible check column to align text where the Main Menu menu uses real icons. The two menus read as two designs.

## Solution

State the rule in the guide, then bring the Locations Canvas menu under it.

The rule: every menu row is one of two kinds. A row that answers "which one?" belongs to a titled set. A row that does something belongs to a flat action set. The title is the collapse handle: when a menu must be compact, a titled set folds into a flyout and the title becomes the flyout label. Action rows never fold, so they carry an icon to stay visually distinct from set rows. Separators divide kinds, not topics.

The Locations Canvas menu then reads as: titled sets (Grid toggles, Connection Style radios), then icon-bearing action rows (history, then what was clicked), in the same order as the Main Menu menu. Its labels shorten because the titles now carry the shared word.

## User Stories

1. As an agent, I want the guide to state why the Main Menu menu is composed as it is, so that I can derive a new context menu instead of copying an existing one.
2. As an agent, I want the guide to define the two row kinds, so that I can classify every row before I place it.
3. As an agent, I want the guide to state that a section title is the flyout handle, so that I know a titled set can fold without redesign.
4. As an agent, I want the guide to state that action rows carry icons because they never fold, so that I do not add icons to set rows or omit them from action rows.
5. As an agent, I want the guide to state that separators divide kinds, so that I do not add a separator between two topics of the same kind.
6. As an agent, I want the guide to say where a context-dependent action section sits, so that a menu whose rows change with the target still follows the order.
7. As an agent, I want the guide to keep the Main Menu row-by-row composition as the worked example, so that the rule and its instance sit together.
8. As a World Editor author, I want the canvas menu grid toggles under a title, so that I see them as one set of view switches.
9. As a World Editor author, I want the Connection style rows under a Connection Style title, so that the rows read Straight, Curved, Elbow without repetition.
10. As a World Editor author, I want Undo and Redo to show the same icons as the toolbar, so that I recognize them across both surfaces.
11. As a World Editor author, I want Edit Location, Auto Arrange, Clear Selection, Select All Locations, and Auto Arrange All to carry icons, so that action rows read apart from set rows.
12. As a World Editor author, I want the canvas menu ordered like the Main Menu menu, so that both menus feel like one design.
13. As a World Editor author, I want Undo and Redo to stay grayed when their stacks are empty, so that the menu height never moves and I still learn the map has undo.
14. As a World Editor author, I want the menu to omit an empty target section instead of drawing a separator around nothing, so that a right-click on the bare pane shows no stray rule.
15. As a keyboard user, I want arrow keys to move through every row including titled set rows, so that the new titles do not break navigation.
16. As a screen reader user, I want each set to expose its title as the group accessible name, so that I hear which set a row belongs to.
17. As a screen reader user, I want radio rows to keep their checked state and checkbox rows to keep theirs, so that the new titles do not change semantics.
18. As a reviewer, I want the Locations Canvas reference in the showcase to open the real menu, so that I can compare it against the guide section without a new route.
19. As a reviewer, I want the section builder to name the title and icon of each section and row, so that the composition is decided in one place and the component only draws it.
20. As a maintainer, I want the shared context-menu primitives unchanged, so that the Main Menu menu cannot drift from this change.
21. As a maintainer, I want the guide edits to carry no version pin and no reference to agent-only files, so that the wiki publish stays clean.
22. As a user of the guide, I want the new text in the Writing Guide functional voice, so that the guide stays consistent.

## Implementation Decisions

- The Grouped Context Actions pattern in the Design System guide gains a short block after its purpose line that states the rule. Four sentences carry it: two row kinds; a title is the flyout handle; action rows carry icons because they never fold; separators divide kinds. One more sentence states that a context-dependent action section sits where the fixed action section sits and keeps its icons. The existing Composition, Production mapping, Responsive behavior, and State reference blocks stay as the worked example.
- The pattern production mapping table gains one row that points at the Locations Canvas menu as the second production instance.
- The canvas menu section type gains an optional title. The canvas menu item type gains an optional icon. The section builder assigns both. The menu component renders a title with the shared menu label primitive when a section has one, and renders the icon before the label when a row has one.
- Section order becomes: Grid (checkbox set, titled), Connection Style (radio set, titled), history (Undo, Redo, icons), target actions (icons). Sets first, then actions, matching the Main Menu order. No destructive section exists on the canvas today, so none is added.
- Connection style labels shorten to Straight, Curved, Elbow. The shared style list keeps its values; only the presentation label changes. Any other consumer of the long labels keeps them if it has no title to carry the word.
- The grid set title is "Grid". Its rows stay Snap To Grid and Show Grid, because each row must read alone as a checkbox.
- Undo and Redo reuse the toolbar icons. Edit Location, Auto Arrange, Auto Arrange All, Clear Selection, and Select All Locations take icons from the existing icon set; both Auto Arrange rows share one icon.
- The invisible check column on action rows is removed. Alignment comes from the icon column, as in the Main Menu menu.
- Grayed history rows, the omitted empty target section, and the per-target row sets stay as they are.
- The Locations Canvas reference in the showcase is not extended with a new subtab. The guide section points at the existing reference and says to right-click the canvas.
- No export shape, save shape, setting default, or version changes.
- The changelog gets one In Progress entry under the user-facing bucket for the canvas menu, with a bold lead that stands alone. Guide-only edits get no changelog entry.

## Testing Decisions

- A good test drives the surface the way a user does and asserts what the user observes. It does not assert class names or internal state.
- Seam one: the existing section builder suite. Assert the new order, that the Grid and Connection Style sections carry their titles, that the style rows carry the short labels, and that every action row carries an icon while no set row does. Existing cases for graying, omission, and state pass-through stay.
- Seam two: the existing Locations Canvas reference suite. Open the menu by right-click on the pane, then assert by role: two labeled groups with their accessible names, radio rows with one checked, checkbox rows with their checked state, and action rows present with their names. Assert the menu closes on Escape and focus returns to the canvas.
- Prior art: the section builder suite already asserts order and state in plain objects. The Main Menu context menu reference suite already opens a menu by role and asserts group labels and checked rows. The Locations Canvas reference suite already reads the toolbar by role.
- The guide edit gets no automated test. The docs link check covers the new citation.

## Out of Scope

- Any flyout implementation. The rule states that titled sets can fold; no menu folds today, and the shared primitives gain no submenu.
- The Main Menu tile menu, its picker, and the shared context-menu primitives. They stay as the worked example.
- The gameplay Location Map, which suppresses the browser menu and has none of its own.
- A new showcase subtab or route.
- The Delete Group destructive styling gap and the other open items in the Design System Guide Drift spec.
- Renaming Delete or any app-wide terminology decision.

## Further Notes

The Design System Guide Drift spec touches the Locations Canvas guide rows for fullscreen and search. This spec touches the Grouped Context Actions section and the canvas menu code. The two do not overlap in the guide, so either can land first.

The rule as stated makes flyouts a stated option, not a plan. If a future menu grows past comfortable height, the title-to-flyout step is the first move, and the shared primitives would gain a submenu then.
