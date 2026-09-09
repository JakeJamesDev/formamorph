# 03: Give Canvas Action Rows Icons And Drop The Hidden Check Column

Status: ready-for-human
Base: 21fa4d96
Blocked by: 01, 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

## What to build

Right-click the Locations Canvas. Every action row shows an icon before its label: Undo and Redo reuse the toolbar icons; Edit Location, Auto Arrange, Auto Arrange All, Clear Selection, and Select All Locations take icons from the existing icon set, with both Auto Arrange rows sharing one. Set rows show no icon. Labels align from the icon column, as in the Main Menu menu; the invisible check column on action rows is removed.

The canvas menu item type gains an optional icon. The section builder assigns it to every action row. The menu component renders it before the label. The guide production mapping table gains one row that names the Locations Canvas menu as the second production instance, and the section says to right-click the canvas in the existing Locations Canvas reference. The changelog gets one In Progress entry under the user-facing bucket with a bold lead that stands alone.

## Model rationale

Sonnet 5 at high effort suits icon wiring, a guide table row, a changelog entry, and assertions in two existing suites.

## Acceptance criteria

- [ ] Every action row in the section builder output carries an icon; no set row does.
- [ ] Undo and Redo show the same icons as the canvas toolbar.
- [ ] The section builder suite asserts icon presence per row kind.
- [ ] The Locations Canvas reference suite asserts action rows render with an icon and set rows without.
- [ ] No action row reserves a hidden check column.
- [ ] Grayed Undo and Redo keep their icons and disabled state.
- [ ] The guide production mapping table names the Locations Canvas menu as a second instance and points at the existing reference.
- [ ] Changelog In Progress entry added under the user-facing bucket.
- [ ] Four gates green; docs link check passes; graph updated.

## Out of scope

- A new showcase subtab or route.
- Any flyout or submenu primitive.
