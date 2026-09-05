# 03 — Playwright coverage for the new feel

**What to build:** the new drag is provable on the real board, on both viewports, through the existing tile-drag helpers. Each case is a gesture a player makes and an assertion about where tiles end up or what the release meant.

**Blocked by:** 02 — Grid runs on the reader.

**Status:** ready-for-human

- [x] Nothing moves before the rest: travel across a row and release before the delay leaves the others in place and lands the carried tile
- [x] Row push after the rest: three smalls slide one cell toward the hole in one motion
- [x] Diagonal swap: the tile under the far side swaps into the hole and nothing on the path moved
- [x] Large onto a block of smalls: the smalls swap into the large's hole with offsets intact
- [x] Near side rings the target and release groups; the same on a folder tile adds to it
- [x] Blocked spot shows and a release there snaps home with nothing else changed
- [x] Escape mid-gesture restores every tile; holes persist after a move and a reload
- [x] Touch: the same row push and the same near-side group under touch input
- [x] Timing proven per-frame in Playwright only; no timer claims from the Browser pane
- [x] e2e green on both viewports

## Comments

The suite is `e2e/tile-drag-gesture.spec.ts`, six cases on the desktop board and two under touch on the
phone. Every board is built through the UI — sizes from the context menu, setup carries into open cells
— and every case asserts the whole board's cells before and after, so a tile that moved when it should
not have fails as loudly as one that did not move when it should.

**Two boxes were already ticked elsewhere and are not repeated.** A near-side rest ringing the target
and grouping on release is parity R10; adding to a standing folder the same way is the last case in
`mixed-size-drag.spec.ts`. Both run on a mouse, so the new suite carries the touch half of each instead.
Escape and the persistent hole exist in `mixed-size-drag.spec.ts` too, but only over open board, where
the preview has nothing to put back — the new cases cancel an armed push and reload after a move.

**Boards are asserted before the gesture, not assumed.** Resizing repacks and a commit folds dead rows
and columns, so a setup that drifts would otherwise fail as a broken rule. Each case states the cells
its setup has to have produced first.

**The blocked case had to be built.** A block is hard to reach on the seeded board because the reader
tries every candidate spot before it gives up, and for an unequal-size target there are four of them. It
takes a small carried onto a medium with a bystander directly above it: the two same-column spots push
the medium onto the bystander, and the two diagonal ones would take it off the top of the board. All
four refuse, so the nearest stands and the overlay draws its refusal.

**Guards proven by reinstating the bug.** Rest delay to 0 → the travel case fails with "moved under the
sweep". Bystander check dropped from `applyMove` → the blocked case fails with no refusal drawn. Swap
narrowed to one hit tile → the block-of-smalls case fails. Push distance doubled → the row push fails.
Every rest read as a push → the diagonal swap fails.

**A local-only flake worth naming, and it is not this suite's.** The first page load against a freshly
started dev server can take longer than Playwright's 30s per-test timeout on this machine, which reads
as `waitForFunction: '__fmDev' in window` and can take a whole spec file down with it. Measured on a
clean run of `mixed-size-drag.spec.ts`: 46.8s for the first test, 4-10s for the other eight. It gets
much worse while other Vite servers for this repo are up. Local runs want `--timeout=90000`; CI's one
retry absorbs it.
