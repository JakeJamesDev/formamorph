# 02: Give The Canvas Menu Titled Sets In Main Menu Order

Status: ready-for-human
Base: 71954664
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

## What to build

Right-click the Locations Canvas. The menu opens with two titled sets first: Grid, holding the Snap To Grid and Show Grid checkboxes, then Connection Style, holding the Straight, Curved, and Elbow radios. History and the target actions follow, each in its own section, as today.

The canvas menu section type gains an optional title. The section builder assigns the two titles and returns sets before actions. The menu component renders a title with the shared menu label primitive when a section has one. Connection style rows use short presentation labels because the title now carries the shared word; the shared style list keeps its values and any consumer without a title keeps the long labels.

Grayed history rows, the omitted empty target section, and the per-target row sets stay as they are.

## Model rationale

Sonnet 5 at high effort suits a small typed change across a pure builder, one component, and two existing suites.

## Acceptance criteria

- [x] The section builder returns Grid, Connection Style, history, then target actions, and omits an empty target section.
- [x] The Grid and Connection Style sections carry their titles; history and target sections carry none.
- [x] Connection style rows read Straight, Curved, Elbow in the menu.
- [x] The section builder suite asserts the new order, the titles, and the short labels; existing graying, omission, and pass-through cases stay green.
- [x] The Locations Canvas reference suite opens the menu by right-click and asserts by role: two labeled groups with their accessible names, radios with one checked, checkboxes with their checked state, action rows by name.
- [x] The Locations Canvas reference suite asserts Escape closes the menu and focus returns to the canvas.
- [x] Arrow keys move through every row; titles are not focus stops.
- [x] Shared context-menu primitives are unchanged.
- [x] Four gates green; graph updated.

## Out of scope

- Icons on action rows and the hidden check column (ticket 03).
- The changelog entry (ticket 03).
