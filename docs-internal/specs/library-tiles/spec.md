# Spec: Library Tiles and Groups

Status: ready-for-agent

## Problem Statement

The main menu library is a flat grid. As a player's collection of worlds, entities, dictionaries, and avatar models grows, the grid becomes long and unstructured. Every item takes the same visual weight, favorites cannot stand out, and rarely used items cannot be tucked away. The only organization tool today is manual drag-reorder.

## Solution

A Windows-style tile system for all four library tabs:

- **Per-tile sizes.** Each tile can be small (½×), medium (1×, the current size), or large (2×). Tiles keep their aspect ratio. Sizes apply in the grid layout only.
- **Groups.** A group is a folder tile in the grid. It shows a 2×2 mini mosaic of member thumbnails and the group name. Clicking it navigates into a full folder view with a back button. Groups hide their members from the main grid.
- **Group settings.** A world group can optionally carry settings that apply to its members. V1 ships one setting: the prompt preset. The stored shape is an extensible map so future settings need no migration.

All organization state is device-local. Nothing changes in the world or save export shape.

## User Stories

1. As a player, I want to set a library tile to small, so that rarely used items take less space.
2. As a player, I want to set a library tile to large, so that my favorite worlds stand out.
3. As a player, I want tiles to keep their aspect ratio at every size, so that thumbnails never distort.
4. As a player, I want small tiles to flow into gaps beside large tiles, so that the grid stays tidy without manual fiddling.
5. As a player, I want consecutive small tiles to stack in columns (four fill one medium slot), so that small tiles use space like Windows tiles.
6. As a player, I want to drop a small tile on another small tile's top or bottom edge, so that I can stack them vertically by hand.
5. As a player, I want to change a tile's size from its context menu (right-click or long-press), so that resizing is quick and discoverable.
6. As a player, I want to drag one tile onto another to create a group of the two, so that grouping feels like Windows.
7. As a player, I want to drag a tile onto an existing folder to add it, so that growing a group is one gesture.
8. As a player, I want a context-menu "Add to group" action with a group list and a "New group" entry, so that I can group without precise drag gestures.
9. As a player, I want grouped items hidden from the main grid, so that grouping actually declutters.
10. As a player, I want to click a folder tile and enter a full folder view with a back button, so that browsing a group feels like entering a room, not squinting at a popup.
11. As a player, I want to reorder and resize tiles inside the folder view, so that a group is a first-class grid.
12. As a player, I want to remove an item from a group and have it return to the main grid, so that grouping is reversible.
13. As a player, I want to drag a tile out of a folder by dropping it on the folder view's header ("move out of group" zone), so that ungrouping is a gesture, not only a menu action.
13. As a player, I want to rename a group inline in the folder view header, so that naming is in context.
14. As a player, I want deleting a group to disband it and return its members to the main grid, so that I never lose items by deleting a folder.
15. As a player, I want the folder tile to show a 2×2 mosaic of member thumbnails, so that I can recognize a group at a glance.
16. As a player, I want folder tiles to be sizable like normal tiles, so that important groups can also stand out.
17. As a player, I want groups on every library tab (worlds, entities, dictionaries, models), so that organization works the same everywhere.
18. As a player, I want groups scoped per tab, so that a world group never mixes with entity items.
19. As a player, I want small tiles to show the item name in a tooltip instead of a cramped overlay, so that small tiles stay clean and readable.
20. As a player, I want groups to also appear in the detailed layout as uniform cards with a mosaic, name, and member count, so that detailed-mode users keep their organization.
21. As a player, I want the detailed layout's cards to stay uniform in size, so that text-heavy cards remain readable.
22. As a player using a world group, I want to set a prompt preset on the group, so that every world inside uses that preset without per-world setup.
23. As a player, I want an explicit per-world prompt pin to beat the group setting, so that one world in a group can still be special.
24. As a player, I want a world with no pin and no group setting to follow the global preset, so that the existing default behavior is unchanged.
25. As a player, I want the world-details prompt selector to show where the effective preset comes from (world pin, group, or global), so that I understand what will run.
26. As a player, I want a group setting that names a deleted preset to fall back silently to the next level, so that stale pins never break entering a world.
27. As a player on mobile, I want long-press to open the tile context menu and touch drag to group and reorder, so that the system works without a mouse.
28. As a player, I want my existing manual card order preserved when the feature ships, so that the update does not scramble my library.
29. As a returning player on the same device, I want my groups, sizes, and order restored, so that organization persists across sessions.
30. As a world author, I want library organization kept out of world exports and community publishes, so that my personal arrangement never leaks with shared content.
31. As a player, I want contest badges, delete buttons, and other card affordances to keep working on tiles inside folders, so that a grouped item loses no functionality.

## Implementation Decisions

- **One new pure module owns organization state.** Per-tab state = groups (id, name, member ids, size, settings map), per-tile sizes, and top-level order (a list of item ids and group ids). All operations are pure functions: create-group-from-drop, add member, remove member, disband, rename, set size, reorder. The UI layer only dispatches these operations and renders the result.
- **Persistence is device-local browser storage**, alongside the existing order keys. The codec reads the legacy flat per-tab order arrays as the migration source; unknown ids keep the existing sort-to-end behavior. No IndexedDB change, no export-shape change, no version bump.
- **No nesting.** The top level holds items and groups; groups hold only items. Operations reject group-into-group.
- **Sizes** are `small | medium | large` at ½× / 1× / 2× linear scale. The grid layout uses a doubled-resolution CSS grid (half-width, half-height base cells): small spans 1×1, medium 2×2, large 4×4. Aspect ratios per tab (landscape for worlds, portrait for entities) are unchanged.
- **Placement comes from a pure packer, not CSS auto-flow.** The packer walks the order list and first-fits each tile into the base-cell grid, so later small tiles backfill holes. Runs of consecutive small tiles pack column-first: the second stacks below the first (two deep, one medium slot height), then the run moves to the next column — four smalls fill one medium slot. The packer is a pure function (order list + sizes + column count in, cell positions out) and lives in the organization module. A prototype validated this; the run rule is: within a run keep an anchor row, place below the previous small while depth < 2 and the cell is free, else advance one column at the anchor row, else first-fit a new run anchor.
- **Sizes apply to the grid layout only.** The detailed layout renders items and groups as uniform cards. Groups work in both layouts.
- **Folder navigation is a view state within the tab**, not a modal: the grid swaps to the group's member grid with a back button and the inline-renamable group name as the header. New groups start as "New Group".
- **Group settings** are stored as a map on the group record. V1 surfaces one key, the prompt preset, and only on world groups. The settings UI is scoped so other tabs show no empty panel.
- **Prompt resolution precedence**: explicit per-world pin > group setting > global selection. Resolution extends the existing per-world preset pin logic (including its deleted-preset fallback) rather than adding a parallel path. Applied at gameplay entry exactly where the world pin applies today.
- **Context menu** is the home for size selection, group membership actions, and group deletion. Long-press opens it on touch.
- **Drag semantics**: dropping onto a tile's center region groups; dropping between tiles reorders. Small tiles use top/bottom drop edges (insert before/after, which stacks vertically via the packer); other tiles use left/right edges. Both ride the existing dnd-kit sortable setup.
- **Drag-out of a folder**: while a drag is active inside the folder view, the header shows a "move out of group" drop zone; dropping there removes the item from the group. The context-menu Remove action stays.
- **Group deletion disbands.** Members are appended back to the top-level order. Item deletion inside a folder behaves exactly as in the main grid.
- **Small-tile naming** uses the project's themed tooltip; medium and large keep the current name overlay strip.

## Testing Decisions

- Good tests here assert **external behavior of the pure organization module**: given a state and an operation, the resulting state — never internal representation details or storage key layout beyond the codec's own contract.
- **The organization module carries the behavioral suite**: grouping operations, disband-returns-members, no-nesting rejection, per-tab isolation, size assignment, order/group interplay, the settings map, and legacy-order migration in the codec.
- **The packer is unit-tested as a pure function**: hole backfill, column-stacking of small-tile runs (four fill a medium slot), span overflow at the grid edge, and stability across column counts.
- **Preset precedence tests** sit with the existing world-prompt-preset logic: pin beats group, group beats global, deleted-preset fallback at each level.
- **Prior art**: the existing vitest unit suites for pure library logic and the world-prompt-preset helpers; the Playwright e2e suite (`npm run test:e2e`) for one flow — create a group by drag, enter the folder view, go back.
- **UI is not unit-tested.** Rendering of packed positions, tooltips, and navigation are verified in the live preview via the dev-router; drag gestures via the single e2e flow.
- Tests must fail when their guarded rule is reinstated as a bug (mutation check), per the project test bar.

## Out of Scope

- Syncing organization between devices, or including it in any export, publish, or backup surface.
- Nested groups.
- Size variants in the detailed layout.
- Group settings beyond the prompt preset, and settings on non-world groups (the shape supports them; the UI does not).
- The Load Game dialog's own folder system (already exists, untouched).
- The community browser (its filtering is separate machinery).
- Search or sort controls for the library.
- A toolbar "New group" button.

## Further Notes

- "Avatars" in the discussion = the models tab.
- Organization state is deliberately excluded from export/publish/backup, matching the existing per-world prompt pin, readme suppression, and order keys.
- The world-details prompt selector should indicate the effective source (pin / group / global) when a world sits in a group with a preset.
- Windows tile groups were the reference model: folder tiles, mini mosaics, drag-to-group. The navigate-in folder view is a deliberate departure from the Windows overlay.
