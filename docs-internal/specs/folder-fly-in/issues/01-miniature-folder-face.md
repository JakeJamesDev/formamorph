# 01: Miniature Folder Face

Status: ready-for-human
Base: 74c62704
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: one new presentational component and a prop on the folder tile, with a working prototype
to read. The placement logic already exists.

## What to build

In the grid layout, a folder tile shows a miniature of its own board instead of the 2×2 mosaic. Each
member's thumbnail stands at the cell and the size it has in the open folder, scaled so the board width
equals the tile width. The tile shows the top rows that fit. The name bar and the count stay; the `+N`
badge goes. The detailed layout keeps the mosaic.

The prototype on branch `prototype/folder-fly-in` is the primary source. Rewrite it; do not copy it.

Decisions from the spec:

- The miniature reads placements from the same placement resolver and the same span rule as the open
  folder board, at the same column count. The two must not be able to drift apart.
- It draws the board at its real pixel size and shrinks it with one `scale(tileWidth / boardWidth)`
  transform, origin top-left, aligned to the tile's border box.
- It draws plain thumbnails, not the card components, because cards register sortables.
- It draws only the rows that fit the tile.
- In a filtered view it draws only the members the filter passes, at the filtered placements the filtered
  folder board uses.
- The drag overlay's stand-in for a carried folder is not part of this ticket.

## Acceptance criteria

- [x] A folder tile in the grid layout draws each member at the cell and span the open folder gives it
- [x] A member sized small or large shows at that size in the miniature
- [x] Holes in the folder board show as holes in the miniature
- [x] The miniature repacks when the column count changes
- [x] A filtered view draws only passing members, packed as the filtered folder board packs them
- [x] The detailed layout still draws the mosaic
- [x] The `+N` badge is gone in the grid layout; the name bar and the count remain
- [x] A small folder tile still gives its name and count as a tip
- [x] Adding, removing, resizing, or moving a member updates the miniature
- [x] jsdom tests in the existing grid test files cover the cell/span match, the filtered view, and the detailed layout, and each fails when its behavior is broken
- [x] `docs/Changelog.md` In-Progress entry added
- [x] Four gates green; no export-shape change
