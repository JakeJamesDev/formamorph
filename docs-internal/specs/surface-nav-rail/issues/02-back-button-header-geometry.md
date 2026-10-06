# 02: One Back Button And Surface Header Geometry

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: one small shared component and padding changes in two hosts on both layouts, verified by measurement; contained.

## What to build

One **back button** serves every surface header: a borderless ghost icon button with a 16px arrow, named Back (Q26). The World Editor and Community Creations use it on desktop and mobile.

Every surface header has 12px sides with its first row centered in 56px, and the same spacing from the back arrow to the title. On mobile the editor's card draws no top border of its own under the window's border, so its arrow does not sit a pixel low. Community's desktop title row keeps filling its header so the search box grows into the free space.

This ticket works on main's current headers; tickets 05 and 07 move those headers later and keep the geometry. Changelog fragment: the lead **The World Editor and Community Creations move their sections to a collapsible side rail.** and a sentence on the back arrow sitting in one place on every screen.

From the prototype branch `prototype/world-editor-tabs` (final commit `dbe3c035`, Community header `54a3e233`); launch entry `proto-world-editor-tabs`, port 5245. Commits `fb85eac3`, `dbe3c035` and `51d3763b` carry the geometry.

## Acceptance criteria

- [ ] On the World Editor and Community Creations, desktop and mobile, the back button measures 40px with a 16px icon and no visible border.
- [ ] In each of the four headers the button sits at the same offset from the window's top-left corner.
- [ ] The title starts at the same x on both desktop surfaces.
- [ ] Community's desktop search box fills the space between the title and the controls to its right.
- [ ] Every back button has the accessible name Back.
- [ ] Gates green; changelog fragment written.

## Blocked by

- None (can start immediately)
