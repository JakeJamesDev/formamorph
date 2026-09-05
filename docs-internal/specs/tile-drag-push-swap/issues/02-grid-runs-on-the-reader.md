# 02 — Grid runs on the reader

**What to build:** the library tile board drags the Android way. Nothing moves while the hand travels. Once the pointer's reading has held for the rest delay (250 ms), a move previews live: a shared row or column pushes toward the hole, a diagonal swaps, open space moves only the carried tile. A rest short of the plane rings the target instead, and release groups the carried tile with it or adds it when the target is a folder. A blocked spot shows as blocked and a release there snaps home; a release before the rest still lands on the spot under the hand; Escape restores everything. The same rules apply inside an open folder view (without folder intent) and under touch. Every reading is computed from the pre-drag board. The cell simulation, its consent rule, and the immovable-hold grouping are gone.

**Blocked by:** 01 — Gesture reader (pure module).

**Status:** ready-for-agent

- [ ] The grid's per-move handler feeds the reader from the activator event plus delta, scroll backed out as today; the ghost's top-left anchors nothing in grid layout
- [ ] A rest timer arms the current reading after 250 ms and restarts on any change to anchor, target, or intent; a move previews through the existing slide path; a blocked reading draws the pre-drag board
- [ ] Release commits the current reading's board through the existing placement commit and dead-line collapse; a blocked reading commits nothing; Escape restores
- [ ] Folder intent reuses the existing ring styling and the existing group operations; no folder intent inside an open folder view; folders never nest
- [ ] The cell simulation module and its unit tests are deleted; the consent-only e2e cases (corner poke, sweep-through, carry-through-smalls stacking, hold-to-group over an immovable tile, "makes way is never grouped") are deleted
- [ ] Parity rules that encode the old feel are rewritten and named as changed: the displaced tile moves after the rest rather than at once; parking on a tile's near side groups rather than only moving. The rest of the parity suite stays green
- [ ] Detailed layout drag unchanged; placements, per-width arrangements, resize, and storage shape unchanged
- [ ] Four gates green; e2e green; changelog In-Progress entry
