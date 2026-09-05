# Spec: Tile Drag Push / Swap (Android Home Layout)

Status: ready-for-agent
Status note: prototype settled 2026-09-05 in `prototype.html`; this spec refactors it into the app and retires the cell simulation.

## Problem Statement

The library board reflows under the hand on every cell of travel. Tiles dodge the instant the carried footprint sweeps them, so a long drag leaves a trail of moves the player never meant. Big tiles need a hidden consent count before they move, which nobody can predict. Grouping hides behind a hold over a tile that "cannot move", a condition the player cannot see. The board feels busy and arbitrary.

## Solution

The drag mirrors an Android home screen. Nothing moves until the hand rests. The pointer names the target tile. A rest on the far side of the target moves: along a shared row or column the tiles between pickup and target push toward the hole; across both, the tiles under the target swap into the hole. A rest on the near side folders the carried tile into the target. Every preview is computed from the pre-drag board, so leaving a spot undoes it. A blocked spot shows as such and a release there snaps the tile home.

## User Stories

1. As a library user, I want nothing to move while my drag is in motion, so that passing over tiles never rearranges them.
2. As a library user, I want the board to react only once my hand rests on a spot, so that every move I see is one I meant.
3. As a library user, I want a rest on a tile in my pickup's row to push the tiles between us toward the hole, so that a row reorders like an icon row on my phone.
4. As a library user, I want a rest on a tile in my pickup's column to push the tiles between us toward the hole, so that columns reorder the same way rows do.
5. As a library user, I want a rest on a tile in a different row and column to swap that tile into my pickup's hole, so that a diagonal move trades two spots and touches nothing on the path.
6. As a library user, I want a large tile rested across several smalls to swap all of them into its hole with their offsets intact, so that the block reads as one traded unit.
7. As a library user, I want a rest on open space to move only the carried tile, so that dropping into a hole is surgical.
8. As a library user, I want leaving a spot before release to undo whatever that spot previewed, so that I can browse candidates without committing.
9. As a library user, I want a spot that cannot work to show as blocked, so that I know before release.
10. As a library user, I want a release over a blocked spot to return the carried tile home with nothing else changed, so that a bad drop costs nothing.
11. As a library user, I want a release before the rest completes to still land on the spot under my hand, so that a quick drag is not ignored.
12. As a library user, I want Escape to cancel the drag and restore every tile, so that I can bail out at no cost.
13. As a library user, I want the tile my pointer is over to be the tile the drag acts on, so that what I see under my finger is what the drop means.
14. As a library user, I want the carried footprint to land on the target I am pointing at, biased toward where I picked up, so that a big tile settles back toward home instead of spilling onto neighbors.
15. As a library user, I want a rest on the near side of a tile to fold my carried tile into a folder with it, so that grouping is a place on the tile rather than a hidden wait condition.
16. As a library user, I want the folder intent to show on the target before I release, so that I know a release will group and not move.
17. As a library user, I want a rest on the near side of a folder tile to add the carried tile to that folder, so that folders fill the same way they form.
18. As a library user, I want the move-versus-folder split to follow the line from my pickup to the target, so that "past it" always means move from whichever side I approach.
19. As a library user, I want the same rules inside an open folder, so that arranging members feels like arranging the main grid.
20. As a library user, I want the same rules under touch, so that the phone board is not a degraded mode.
21. As a library user, I want the hole I leave behind to persist, so that my arrangement stays mine and never repacks itself.
22. As a library user, I want a release to still fold away a fully dead row or column, so that the board does not grow empty bands.
23. As a library user, I want each viewport width to keep its own arrangement, so that arranging on my phone never scrambles my desktop.
24. As a library user, I want displaced tiles to slide to their new spots when the rest completes, so that a push or swap reads as one motion rather than a snap.
25. As a developer, I want the gesture rules in one pure module with no DOM or clock, so that every combination is unit-testable.
26. As a developer, I want the cell simulation and its consent rule deleted, so that the codebase holds one drag model, not two.
27. As a developer, I want the parity and mixed-size Playwright suites re-baselined to the new feel, so that "behaves as designed" stays provable.

## Implementation Decisions

- **One pure gesture reader replaces the cell simulation** in the library-organization module family. It is stateless per call: given the pre-drag board (every tile's home and span), the carried id, the column count, the grab cell, the pointer's cell and continuous position, and the slice share, it returns the target under the pointer, the intent, the snapped anchor, the resulting board, the ids that moved, and a blocked flag with a human reason. No sweep history, no consent, no accumulator. The grid component keeps the rest timer and the rendering, as it keeps the group hold today.
- **The consent-based cell simulation is deleted**, with its unit tests and the e2e cases that exist only to prove consent (corner poke, sweep-through, carry-through-smalls stacking). The mixed-size prototype in the resolved spec folder imports it and will stop opening; that spec is done and stays as history.
- **Rest.** A move or a folder arms only after the pointer's reading (anchor + target + intent) has held unchanged for the rest delay, 250 ms, a constant beside the old group hold. Any change to the reading restarts the timer. Release before the rest completes still commits the current reading. The Android-style "wait, then act" is the whole point; there is no setting.
- **Target and intent** (from the prototype; the decision is the formula). The pointer's cell names the target tile. A line runs from the pickup home's center to the target's center. The pointer's position is projected onto that line relative to the target's center, and the target's half-extent along the line is the sum of the absolute direction components times half its span. The far slice covers the slice share of that extent, 50%, fixed:

  ```
  d   = normalize(targetCenter − homeCenter)
  h   = (target.span / 2) · (|d.x| + |d.y|)
  thr = h · (1 − 2 · share)
  s   = (pointer − targetCenter) · d
  intent = s ≥ thr ? move : folder
  ```

  No target (pointer over open board or over the carried tile's own home) is a move.
- **Snapped anchor.** Over a target the grab offset drops out. The anchor range is fixed by size: a bigger carried tile must contain the target, a smaller one must sit inside it, equal sizes take its cells. Candidates in that range are tried nearest the pickup home first, and the first whose move is not blocked wins; if all block, the nearest stands and shows as blocked. In open space the anchor is the pointer's cell minus the grab cell, clamped to the board.
- **Move rule** (from the prototype). With the anchor pinned, tiles under the footprint are the hit. No hit is an open move. Same row or same column as the pickup is a push: every tile intersecting the band between the pickup footprint and the pinned footprint shifts toward the hole by one carried span, along that axis. Otherwise it is a swap: every hit tile translates by the vector from the pinned anchor to the pickup anchor. Either result is valid only if every mover stays on the board, clears the pinned footprint, and lands on no bystander. Blocked carries the first offending tile and why.
- **Push distance stays one carried span.** The "push until clear" variant is parked in the prototype; both block in some layouts and the simpler rule reads better. A bigger target in a shared row therefore blocks, and the player can swap it diagonally or folder into it instead.
- **Folder intent** arms a ring on the target after the rest. Release then creates a group from the carried tile and the target, or adds the carried tile to the target when the target is a folder, through the existing group operations. Folders never nest, and no folder intent exists inside an open folder view. The old immovable-hold arming, its candidate search, and its ring are removed; the ring styling is reused for the new arming.
- **Preview and commit.** While a move is armed the board draws the reader's resulting board live, tiles sliding through the existing FLIP path. A blocked reading draws the pre-drag board. Release commits the current reading's board through the existing placement commit, then the existing collapse of dead rows and columns. Escape restores the pre-drag board. Every reading is computed from the pre-drag board, never from the previous preview.
- **Anchor source.** The grid derives the pointer cell and continuous position from the activator event plus the drag delta, backing out scroll as it does today. The ghost's top-left no longer anchors anything in grid layout.
- **Detailed layout is untouched.** It has no cells; its slide-aside reorder stays.
- **Storage shape is unchanged.** Placements per width, order, groups, sizes all stay as they are. This is app-local state; no world or save export shape is touched.

## Testing Decisions

- A good test asserts where tiles end up and what a release means, never the reader's internals or timer bookkeeping.
- **Pure reader unit tests** cover the intent read (far and near slice on a shared row, a shared column, and a diagonal; both approach sides; open board; own home), the snapped anchor (equal sizes, bigger over smaller with the home bias skipping a blocked candidate, smaller inside bigger), push along both axes including a medium in the band, swap of one and of many, every blocked reason, and the folder case for a folder target. Prior art: the cell sim and placements unit tests in the same module family.
- **Playwright** on the real board, extending the existing tile-drag helpers: nothing moves before the rest, the row push after the rest, a diagonal swap, a large onto a block of smalls, a rest short of the plane ringing the target and grouping on release, adding to a folder the same way, a blocked spot snapping home, a quick release landing without a rest, Escape restoring, holes persisting, touch parity. Prior art: the mixed-size and library-tiles specs.
- **Parity suite re-baselined.** Rules that encoded the old feel are rewritten to the new one and the change is named in each: the displaced tile starts moving after the rest rather than at once; parking on a tile's near side groups rather than only moving. The rest of the suite (drop lands where released, out-and-back leaves order alone, Escape commits nothing, first and last slot reachable, flick and crawl agree, order survives reload, click-versus-drag threshold, one translucent copy, single-frame settle) stays green as the floor.
- Timer behavior is proven per-frame in Playwright, never in the Browser pane, because the pane throttles timers while hidden.

## Out of Scope

- The push-until-clear variant and any push-distance setting.
- Any rest-delay or slice-share setting or UI.
- Automatic compaction, gravity, or repacking.
- Folder nesting, and folder intent inside an open folder view.
- The detailed layout's drag.
- World or save export shape.

## Further Notes

- The prototype at `prototype.html` stays as the reference for feel: left board is the outgoing sim, right board is this spec. Its guide overlay (line, plane, far slice) is a debug aid and does not ship.
- The old spec `docs-internal/specs/mixed-size-drag/` records the decisions this one reverses (consent, sweep-dodge, hold-to-group). Its position-based placements, per-width arrangements, dead-line collapse, grow-in-place resize, and the two-FLIPs rule all survive.
