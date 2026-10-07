# 02: Side Navigation Selection

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: one shared component with three hosts, a sibling bar, and edits to the Design System guide and showcase.

## What to build

In side navigation, the selected section and the hovered section look different in every theme (Q7, Q8).

- **Nav Rail** (World Editor, Community Creations): the selected tab takes the primary fill, with primary foreground text and medium weight. Its edge bar stays and takes the foreground color. Hover keeps the accent fill.
- **Sections Bar** (World Editor on mobile) and the **Enter World** categories list: the same selected fill and hover, with no edge bar, because the list does not select from its left edge. The Sections Bar's semibold weight becomes medium, to match the rail.

Rendered target: `_coloraudit/nav-rail-before-after.png` and `_coloraudit/sections-bar-before-after.png`.

The Design System guide's Nav Rail and Sections Bar state rules change to match. This replaces the rule that hover and selected share the accent fill. The showcase references pick up the change from the components.

Changelog fragment: a Fixed entry stating that the selected section in the World Editor and Community Creations side menus now stands out from the hovered one.

## Acceptance criteria

- [ ] The selected rail tab shows the primary fill, primary foreground text, medium weight and a foreground edge bar. A hovered unselected tab shows the accent fill.
- [ ] The Sections Bar and the Enter World categories show the same selected and hover states, with no edge bar.
- [ ] Hover and selected differ in the graphite, blue and purple themes, in light and dark.
- [ ] Component tests assert the selected and hover classes. Prove they bite by restoring the accent selected fill.
- [ ] Design System guide (Nav Rail, Sections Bar) updated. Changelog fragment written.
- [ ] Gates green.

## Blocked by

- None (can start immediately)
