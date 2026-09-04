# Spec: Mixed-Size Tile Drag (Cell Simulation, Quiet Slide)

Status: done

## Problem Statement

The library board lets players mix small, medium, and large tiles, but the drag only works when every tile is the same size. With mixed sizes, a drop swaps with the wrong tile, teleports groups that barely got touched, or reflows tiles the player never meant to move. Players cannot arrange a mixed-size library with any confidence, and the arrangement they build is not really theirs — the packer reflows it behind their back.

## Solution

Rebuild the tile drag on a cell simulation. Every tile is a group of base cells (small = 1, medium = 2×2, large = 4×4). While a drag runs, the board simulates what an ungrouped board of base cells would do through the **whole gesture**: every cell the dragged footprint sweeps over dodges directly behind its trailing edge, exactly the way the flat grid reorders small tiles. A multi-cell tile moves only once the gesture has swept at least **half of its cells** (accumulated over the path, reversed by backtracking); it then relocates the way its cells did, shape intact. A tile that never consents never moves.

The player sees the **Quiet Slide** treatment: no cells, no percentages, no charge bars. Tiles that really move slide to their new spots live during the drag; the drop outline is the only other signal — normal when the drop is valid, alert-colored when the spot is blocked. Release commits every dodge that really happened; Escape restores everything.

Arrangements become position-based: each tile keeps a (row, column) home per grid width, and holes persist until the player fills them. The board never repacks on its own.

## User Stories

1. As a library user, I want to drag a small tile past another small tile and have it dodge behind my drag, so that mixed boards feel exactly like the flat grid I already know.
2. As a library user, I want a large tile to stay put when my drag only clips its corner, so that a tiny overlap never teleports a big tile across the board.
3. As a library user, I want a group tile to move once my gesture has swept half of its cells, so that pushing through it feels earned and predictable.
4. As a library user, I want consent to accumulate along my drag path, so that sweeping a group column by column eventually moves it even though no single moment covers half of it.
5. As a library user, I want backtracking to undo the sweep, so that retreating from a move leaves the board as if I never went there.
6. As a library user, I want a consenting group to move the way its cells were pushed, shape intact, so that its landing spot follows from my gesture instead of an arbitrary rule.
7. As a library user, I want tiles displaced by my drag to slide live to their new spots, so that I can see the result before I release.
8. As a library user, I want the drop outline to change color when the spot is blocked, so that I know a release there will not claim the spot.
9. As a library user, I want a release over a blocked spot to keep the moves that really happened and leave the blocking tile untouched, so that a failed claim does not throw away the rest of my gesture.
10. As a library user, I want Escape to cancel the drag and restore every tile, so that I can bail out of a bad gesture at no cost.
11. As a library user, I want a drag into open space to move zero other tiles, so that placing a tile in a hole is surgical.
12. As a library user, I want the hole a moved tile leaves behind to persist, so that my arrangement stays mine and never repacks itself.
13. As a library user, I want to carry a large tile through a field of small tiles and have each swept small stack behind my drag in the order I passed them, so that big moves read as pushing through a crowd.
14. As a library user, I want each viewport width to keep exactly the arrangement I left there, so that arranging on my phone never scrambles my desktop board.
15. As a library user, I want a width I have never visited to start from a sensible flow of my existing arrangement, so that a new device shows my library in a familiar order.
16. As a library user, I want new library items to appear in the first free space without disturbing my arrangement, so that importing a world never reflows my board.
17. As a library user, I want deleting an item to free its cells and leave the rest alone, so that removal never causes a reflow either.
18. As a library user, I want folder tiles to obey the same drag rules as item tiles, so that a folder feels like any other tile of its size.
19. As a library user, I want the drag inside an open folder to behave the same way, so that arranging members works like arranging the main grid.
20. As a library user, I want resizing a tile to keep it in place when the new size fits, and to move it to the nearest free space when it does not, so that a resize never destroys the tiles around it.
21. As a library user, I want the arrangement I had before this update to come through as the seed of my new position-based board, so that the update never loses my order.
22. As a library user on a touch device, I want the same drag semantics under touch, so that mobile arranging is not a degraded mode.
23. As a developer, I want the simulation to live in a pure module with no DOM access, so that its combinatorics are unit-testable and reusable.
24. As a developer, I want the uniform-size parity suite to stay green, so that the rebuild provably preserves the shipped small-tile behavior.

## Implementation Decisions

- **Winner**: algorithm D (cell simulation) with the Quiet Slide presentation, chosen from the prototype at `.scratch/mixed-size-drag/prototype.html`. The Pressure and Give Way treatments stay parked in the prototype.
- **Pure simulation module** in the library-organization module family, lifted from the prototype. Contract (from the prototype, trimmed to the decision):
  - A sim is created per gesture from the tiles' homes, the dragged id, the column count, and the consent threshold.
  - `advance(want)` unit-steps the dragged footprint to the wanted anchor. Per unit step, cells on the leading edge hop to the freed trailing edge, guarded so no two cells occupy one spot. Backtracking runs the same steps in reverse.
  - A tile consents when displaced cells / total cells ≥ ½. It relocates by the **modal displacement vector** of its cells, validated against bounds, the pinned footprint, and other homes; its cells then snap into formation there, resetting its accumulator.
  - The result reports the pinned footprint, current homes, moved ids, and a blocked flag with the blocker (not enough swept, or consented with no valid spot).
- **Consent threshold is fixed at half** a tile's cells. No setting, no UI.
- **Quiet Slide presentation**: displaced tiles animate to their sim homes during the drag; the drop outline is normal when valid and alert-colored when blocked. No ghost cells, no progress affordances, no status text. The debug affordances exist only in the prototype.
- **Release semantics**: commit the last valid configuration. Dodges that happened stay; a non-consenting tile never moved, so there is nothing to undo for it. Escape restores the pre-drag arrangement.
- **Position-based arrangement, per width**: the tab organization gains placements keyed by base-cell column count — each width keeps its own (row, column) map, holes included. The stored shape stays additive over the current one; `order`, `groups`, and `sizes` remain. This is app-local localStorage, not world or save export shape.
- **Seeding**: a width first seen derives its placements by reading the nearest stored width in row-major order (falling back to `order`, then the legacy flat order) through the existing packer at the new width. The packer's small-run column-first quirk applies at seed time only.
- **Newcomers and deletions**: a new item first-fits into free cells without moving stored placements; pruning a deleted item frees its cells and leaves everything else in place. The board never compacts or repacks on its own.
- **Drag stack**: dnd-kit stays for sensors, pointer capture, and the drag overlay. The sortable order strategy is replaced by the sim: the pointer position maps to a wanted cell anchor, and each anchor change advances the per-gesture sim. One sim instance per gesture.
- **Scope of the grid**: the same drag applies to all four library tabs and to the open-folder member grid.
- **Resize**: growing a tile keeps its anchor when the grown footprint is free; otherwise the tile relocates first-fit to the nearest free block. Shrinking always keeps the anchor. No refusal state in the app.
- **Order derivation**: anything that still needs a linear order (legacy interop, seeding other widths) reads placements row-major.

## Testing Decisions

- Tests assert external behavior — where tiles end up after gestures — never sim internals such as cell maps or accumulators.
- **Pure module unit tests** cover the sim's combinatorics: sweep accumulation across a path, backtracking reversal, the half-cell consent boundary, modal-vector relocation, bounds and occupancy validation, blocked-vs-stuck reporting, and the placement operations (seeding per width, newcomer first-fit, pruning holes). Prior art: the existing packer and operations unit tests in the same module family.
- **Playwright drag scenarios** on the real board are the highest seam, extending the existing tile-drag helper: the corner-poke refusal, the sweep-through trade, carrying a large tile through smalls, holes persisting after a move-away, Escape restoring, blocked release committing the rest, and per-width independence via a viewport switch. Prior art: the existing library tile and drag-parity Playwright specs.
- The **uniform-size parity suite stays green** as the floor: the rebuild must preserve the shipped flat-grid behavior for boards of one size.
- Codec tests cover the additive shape: round-trip with placements, and legacy data seeding cleanly.

## Out of Scope

- The Pressure and Give Way treatments (parked in the prototype; a later pass may revisit).
- Any consent-threshold setting or UI.
- Automatic compaction, gravity, or repacking of any kind.
- Syncing arrangements across widths after seeding — divergence per width is by design.
- Folder membership gestures (adding to or removing from folders) — unchanged.
- The parked prototype algorithms A, B, and C.
- World or save export shape — this feature touches app-local storage only.

## Further Notes

- The prototype at `.scratch/mixed-size-drag/prototype.html` is the primary source: its pure module holds the reference cell-sim implementation, and its debug board demonstrates every behavior named above. Verified interactions: 25% → 50% consent accumulation through a medium tile; ghost stacking then a two-row relocation while climbing a large tile; backtracking walking the sim home; blocked release committing the rest.
- The mobile-viewport behavior interacts with the packer's clamp of tiles wider than the grid; a large tile on a very narrow width clamps at seed time, which the per-width placement map then owns.
