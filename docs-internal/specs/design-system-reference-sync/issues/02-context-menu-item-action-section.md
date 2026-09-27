# 02: Grouped Context Actions gets an item-action section and a shared persona item

Status: ready-for-human
Base: c8a7f81d
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

The Set as Default Persona / Clear Default Persona menu item is built once, next to the tile menu, and both the Main Menu and the reference call it, so its label and icon cannot drift.

The Grouped Context Actions reference samples a persona entity, shown with the production card treatment the Main Menu uses for that kind. Its menu's last section holds Check for Updates, the default-persona action, and Delete, in that order, each with an icon. No library kind carries Publish together with those two, so the reference shows no Publish; the guide names Publish as an item action in text. Each item action writes a local status line and touches no library. Delete keeps its trash icon and destructive color and opens the existing confirmation. The Tile Size, grouping, picker, and deletion demonstrations stay.

The guide's rule changes: the item's own actions form the final section, each carries an icon, Delete is last in it, arranging sections stay above, and separators divide kinds, not topics. The state table's Destructive row describes the new final section.

Check for parallel sessions on the Main Menu before starting. Another session had it mid-edit when this ticket was written.

Recommended model rationale: moves a menu item out of the Main Menu, a large shared file under concurrent edit, and rewrites a design rule; needs care with intent and regressions.

## Acceptance criteria

- [x] The Main Menu renders the default-persona item through the shared builder, with no behavior change in the game
- [x] The reference sample is a persona entity card; opening its menu shows Check for Updates, the persona action, and Delete as the last section in that order, each with an icon, and no Publish
- [x] Each item action writes a local status line; the existing no-persistence test covers the new actions
- [x] Delete still opens the confirmation and the Restore Sample path still works
- [x] A test opens the reference menu and asserts the last section's order ends in Delete, proven to fail by reordering
- [x] The guide's rule list and Destructive state row say the new rule; new copy has a Writing review entry
- [x] The showcase registry test passes
- [x] Four gates green; verified in the showcase at desktop and 375px, both themes

## Comments

**Hand-over (713e7666 + review follow-up).**

- Built to the spec ruling in 1b2e90a7: the sample is a persona entity, and the reference shows no Publish.
- Observation for a product call: entity tiles have no Publish in their menu, although the entity editor has one.
- Verified in the showcase at desktop (light and dark) and at 375px (light). The 375px dark frame did not repaint in the pane, so it is unverified.
- The Restore Sample test clicks with `fireEvent`: jsdom keeps Radix's body pointer lock after the confirmation closes. A real browser cleared it (DOM read).
- The icon check reads the row's `svg`: the icon is decorative, so no accessible name carries it.
