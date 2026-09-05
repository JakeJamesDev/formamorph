# 02 — Grid runs on the reader

**What to build:** the library tile board drags the Android way. Nothing moves while the hand travels. Once the pointer's reading has held for the rest delay (250 ms), a move previews live: a shared row or column pushes toward the hole, a diagonal swaps, open space moves only the carried tile. A rest short of the plane rings the target instead, and release groups the carried tile with it or adds it when the target is a folder. A blocked spot shows as blocked and a release there snaps home; a release before the rest still lands on the spot under the hand; Escape restores everything. The same rules apply inside an open folder view (without folder intent) and under touch. Every reading is computed from the pre-drag board. The cell simulation, its consent rule, and the immovable-hold grouping are gone.

**Blocked by:** 01 — Gesture reader (pure module).

**Status:** ready-for-human

- [x] The grid's per-move handler feeds the reader from the activator event plus delta, scroll backed out as today; the ghost's top-left anchors nothing in grid layout
- [x] A rest timer arms the current reading after 250 ms and restarts on any change to anchor, target, or intent; a move previews through the existing slide path; a blocked reading draws the pre-drag board
- [x] Release commits the current reading's board through the existing placement commit and dead-line collapse; a blocked reading commits nothing; Escape restores
- [x] Folder intent reuses the existing ring styling and the existing group operations; no folder intent inside an open folder view; folders never nest
- [x] The cell simulation module and its unit tests are deleted; the consent-only e2e cases (corner poke, sweep-through, carry-through-smalls stacking, hold-to-group over an immovable tile, "makes way is never grouped") are deleted
- [x] Parity rules that encode the old feel are rewritten and named as changed: the displaced tile moves after the rest rather than at once; parking on a tile's near side groups rather than only moving. The rest of the parity suite stays green
- [x] Detailed layout drag unchanged; placements, per-width arrangements, resize, and storage shape unchanged
- [x] Four gates green; e2e green; changelog In-Progress entry

## Comments

Two changes to what the ticket prescribed, both forced by what the board actually did:

- **The reading is fed by the pointer stream, not by dnd-kit's delta.** That delta is the *modified*
  translate, so `restrictToFirstScrollableAncestor` bleeds into it twice: it shifts the read, and once
  the clamp bites dnd-kit stops firing move events at all. Near the bottom of a phone list the drag
  went deaf and every far-side rest read as a near-side one. The grid now tracks `mousemove` /
  `touchmove` in the capture phase — the same streams the sensors read, and not `pointermove`, which
  the browser coalesces to the frame and would run the reading several moves behind the hand. dnd-kit's
  event stays wired up alongside it, because a list scrolling under a still hand moves the board
  without moving the pointer. Scroll no longer needs backing out: the grid's own box carries it.
- **Half the gutter counts into the cell on each side of it.** Dividing by the pitch alone piles every
  gutter onto one side, so a tile's middle read a twentieth of a cell short of its middle — enough to
  put a rest on a tile's center in the wrong half, which is exactly the move-versus-folder split.

One e2e case was deleted beyond the list: **"a blocked release keeps the moves that really happened"**.
It asserted the old rule — that a blocked release keeps the dodges the sweep earned — and there are no
dodges to keep now. A blocked reading commits nothing, which ticket 03 covers on a purpose-built board;
a block is hard to arrange on the seeded one, because the reader tries every candidate spot before it
gives up. **"a drop onto a standing folder"** was rewritten rather than deleted: it now rests on the
folder's near side.

The e2e helpers gained `aim` (`near`/`far`), so a case that means one side of the split is not measured
on the boundary between them, and `reaim`, which re-reads the destination on arrival for a list that
auto-scrolled under the hand.

Gates: `typecheck` 0 errors · `lint` 0 errors (2 pre-existing tsdoc warnings in `localNetworkEmbed.ts`)
· `test` 8180 passed, 56.7s · `build` ok. E2E: the three tile specs are 47/47 on both viewports. The
full suite's other failures — 4 in `location-canvas`, 6 in `site-pages` — were reproduced at HEAD and
belong to another session's in-flight work.
