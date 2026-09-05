# 01 — Gesture reader (pure module)

**What to build:** one pure function in the library-organization module family that turns a single pointer reading into what the drag means. Given the pre-drag board (every tile's home and span), the carried id, the column count, the grab cell, the pointer's cell and continuous position, and the slice share, it returns the target tile under the pointer, the intent (move or folder), the snapped anchor, the resulting board, the ids that moved, and a blocked flag with a human reason. No DOM, no clock, no history between calls.

**Blocked by:** None — can start immediately.

**Status:** ready-for-human

Decisions this ticket encodes (from the prototype; the formula is the decision):

```
d   = normalize(targetCenter − homeCenter)
h   = (target.span / 2) · (|d.x| + |d.y|)
thr = h · (1 − 2 · share)          // share = 0.5
s   = (pointer − targetCenter) · d
intent = s ≥ thr ? move : folder   // no target ⇒ move
```

- Snapped anchor over a target: the anchor range is fixed by size (bigger must contain the target, smaller must sit inside it, equal takes its cells); candidates are tried nearest the pickup home first and the first whose move is not blocked wins; if all block, the nearest stands as blocked. In open space: pointer cell minus grab cell, clamped to the board.
- Move rule: no hit is an open move. Same row or column as the pickup pushes every tile in the band between the two footprints by one carried span toward the hole. Otherwise every hit tile translates by the pinned-to-pickup vector. Valid only if every mover stays on the board, clears the pinned footprint, and lands on no bystander.

- [x] Intent: far and near slice on a shared row, a shared column, and a diagonal, from both approach sides; open board and the carried tile's own home read as move
- [x] Anchor: equal sizes take the target's cells; a bigger carried tile skips a blocked nearest candidate for the next nearest; a smaller one sits inside the target; open space follows the grab cell
- [x] Push along both axes, including a medium in the band; swap of one tile and of a block of smalls with offsets intact
- [x] Every blocked reason is reachable: leaves the board, still under the carried tile, lands on a bystander
- [x] A folder target reads as folder intent on its near side like any tile
- [x] Tests assert outcomes only, never internals; prior art is the placements and cell-sim unit tests
- [x] Four gates green
