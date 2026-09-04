# Library Drag Parity: Restore The Pre-Groups Drag And Drop

Status: ready-for-agent

## Problem Statement

Library tile drag and drop has been through four implementations since the tile board landed, and every one broke a behavior the old flat grid did correctly: reorder previews flapped, tiles snapped back, groups formed from ordinary drops, backtracking diverged from the screen. The player wants the drag behavior they had **before groups existed** — the plain, predictable, smooth sortable-grid feel — with no drag gesture ever creating or joining a group. Trust in "fixed" claims is spent; only a test suite that provably encodes the old behavior can close this.

## Solution

Two deliverables, strictly ordered:

1. **A parity test suite** that encodes the old flat grid's drag behavior as executable checks, written against app-level selectors that exist in both the old and the new UI. The suite is validated by running it against the actual pre-groups code (a git worktree at the commit before the tile board) and passing there.
2. **The new tile grid rebuilt to pass that suite 1:1.** All drag-to-group behavior is removed: no hover timer, no overlap charge, no arming ring, no fold-on-drop. A drag does exactly one thing — move a tile. Groups remain a feature, reachable only through the context menu.

## Old Behavior (the parity target, read from the pre-groups code)

The old grid was stock dnd-kit: `closestCenter` collision, `rectSortingStrategy` displacement, `arrayMove` applied once at drop. That yields these observable rules:

- **R1 — Instant preview.** The moment the carried tile is over another tile, the displaced tiles slide aside to show the result. No delay, no settling period.
- **R2 — Smooth motion.** Displaced tiles slide with a transition; they never snap between positions.
- **R3 — Drop takes the slot.** Releasing over a tile puts the carried tile at that tile's position; tiles between shift by one.
- **R4 — Backtracking is free.** Moving back over ground already crossed un-displaces it; releasing over the carried tile's own slot changes nothing.
- **R5 — Nothing commits until release.** Escape, or releasing outside the grid, leaves the order exactly as it was.
- **R6 — Ends reachable.** Dropping on the first tile makes the carried tile first; on the last, last.
- **R7 — Speed-independent.** A fast drag and a slow drag with the same start and end produce the same result. No behavior depends on how long the pointer rested anywhere.
- **R8 — Persistent.** The committed order per tab survives reload.
- **R9 — Same activation.** Mouse drags start after a small movement threshold; touch drags start after a long press, so a tap still selects and a swipe still scrolls.
- **R10 — Never a group.** (New, but the old grid trivially satisfied it.) No drag gesture creates a folder, adds to a folder, or shows any group affordance.

## User Stories

1. As a player, I want dragging a tile to immediately preview where it will land, so that I never guess at the outcome of a drop.
2. As a player, I want displaced tiles to slide smoothly aside, so that the board reads as one continuous motion instead of jumps.
3. As a player, I want my drop to put the tile exactly where the preview showed it, so that the preview is a promise, not a guess.
4. As a player, I want to move a tile out and back again before releasing and end with nothing changed, so that exploring a drag costs nothing.
5. As a player, I want to press Escape mid-drag and have everything return, so that no drag is a commitment until I release.
6. As a player, I want to drop a tile on the first or last position of the grid, so that every slot is reachable.
7. As a player, I want a fast flick-drag to behave identically to a careful slow one, so that the board never punishes speed or hesitation.
8. As a player, I want a drag to never create a folder, so that reordering my library cannot accidentally restructure it.
9. As a player, I want a drag to never add a tile to an existing folder, so that folders only change when I use the menu.
10. As a player, I want no rings, highlights, or timers to appear while I drag, so that the only feedback is the reorder preview itself.
11. As a player, I want to create and fill folders from the tile's right-click menu, so that grouping still exists without touching the drag gesture.
12. As a player, I want the reorder I made to still be there after closing and reopening the app, so that arranging my library is done once.
13. As a player, I want the same drag behavior on every library tab, so that worlds, entities, dictionaries, and avatars all feel like one system.
14. As a player, I want the same drag behavior in the grid layout and the detailed layout, so that switching layouts never changes how my hands work.
15. As a player, I want the same drag behavior inside an open folder, so that arranging members feels like arranging the main grid.
16. As a mobile player, I want a long press to start a drag and a swipe to scroll, so that arranging and browsing coexist on a touch screen.
17. As a mobile player, I want a tap to still open a tile, so that drag activation never eats plain clicks.
18. As a player using reduced motion, I want reorder previews without decorative animation, so that the board respects my system setting.
19. As a player with mixed tile sizes, I want small, medium, and large tiles to reorder under the same rules, so that sizing and ordering stay independent features.
20. As a player, I want dragging a folder tile to reorder it like any other tile, so that folders are first-class tiles on the board.
21. As a developer, I want the parity suite proven against the actual pre-groups code, so that "matches the old behavior" is a measurement, not an opinion.
22. As a developer, I want the suite to drive real trusted input through the running app, so that the class of bugs that only real input catches stays caught.
23. As a developer, I want per-frame motion sampling on at least one slide assertion, so that "smooth" is a measured property, not a claim.

## Implementation Decisions

- **The suite comes first and is validated against history.** The parity spec file is written against app-level observables (thumbnail order by `alt`, bounding boxes, absence of group headings) that exist in both UIs. It is copied into a temporary git worktree checked out at the commit **before** the tile board landed, and must pass there before the new implementation is touched. R10 is vacuously green there; every other rule must be genuinely exercised.
- **The new implementation keeps the canonical dnd-kit shape that already landed** — carried tile in a drag overlay, the in-flow element as the dimmed hole, the drawn order as real state, displaced tiles moved by the library's own layout animations, drop persists the drawn list wholesale — and **removes every group mechanism from the drag path**: the hover timer, the overlap ratio check, the charge/arm state, the ring, and the fold-on-drop branch. The slide-aside happens immediately on over-change, which is what R1 and R7 require; the previous 150 ms settling beat existed only to make room for drag-grouping and leaves with it.
- **Groups stay, menu-only.** Create New Group, Add To Group, Remove From Group, Open Group, Delete Group, rename, and the folder prompt preset are untouched. Dropping a carried tile onto a folder tile reorders around it exactly as with any tile.
- **The Move Out Of Group drop zone in the folder header is removed** along with the other drag-based group mechanics; Remove From Group in the menu covers it. One rule: drags move tiles, menus change groups.
- **The order-commit operation stays** (write the drawn list wholesale per tab or folder); the shared editor drag context and reference-stable sortable id list from the drag-invariants refactor stay.
- **No settings, no export-shape changes, no new persistence.** The arrangement storage is untouched.

## Testing Decisions

- **One seam: Playwright e2e against the running app with real input.** This is the established seam for drag behavior in this repo, and the only harness that has ever caught this feature's real bugs; jsdom structurally cannot see any of it. No new seams.
- **Good tests here assert observable outcomes only**: the order of thumbnails, presence/absence of group headings, bounding-box positions mid-drag, sampled motion. Never component state, never internal timers.
- **Every rule R1–R10 gets at least one test**, on desktop and mobile projects. R2 uses the per-frame drag-sampling helper already in the e2e tree (prior art: the dictionary drag animation spec). R7 is a pair: the same gesture fast and slow, asserted to identical outcomes. R10 asserts no group heading exists after drops onto tile centers held for over a second — the exact gesture that used to fold.
- **Prior art:** the existing library tiles spec (reorder, persistence, folder navigation), the dictionary drag spec (motion sampling), the editor list drag spec.
- **The existing library tiles e2e is reshaped, not duplicated**: its group-gesture tests are deleted with the gesture; its folder navigation and menu tests survive.
- **Unit tests** stay where they are: the pure organization operations, packer, and codec suites are unaffected except for deleting anything that exists only to serve drag-grouping.

## Out of Scope

- Any drag gesture that creates, fills, or empties groups — explicitly rejected, not deferred.
- Changes to tile sizes, the packer, folder views, presets, persistence shape, or the context menu beyond removing nothing-but-drag-group items.
- Reintroducing any hover, dwell, overlap, or charge mechanic in any form.
- Visual redesign of the drag overlay or hole beyond what parity requires.

## Further Notes

- The drag-to-group idea is dead in this spec, not in the product. If it ever returns, it returns behind its own spec, with this parity suite as a permanent regression floor: any future gesture must keep R1–R9 green.
- Four failed iterations preceded this spec. The lesson encoded here: behavior parity is defined by a suite run against the historical code, never by anyone's description of what the old code did.
