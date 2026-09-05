# 03 — Playwright coverage for the new feel

**What to build:** the new drag is provable on the real board, on both viewports, through the existing tile-drag helpers. Each case is a gesture a player makes and an assertion about where tiles end up or what the release meant.

**Blocked by:** 02 — Grid runs on the reader.

**Status:** ready-for-agent

- [ ] Nothing moves before the rest: travel across a row and release before the delay leaves the others in place and lands the carried tile
- [ ] Row push after the rest: three smalls slide one cell toward the hole in one motion
- [ ] Diagonal swap: the tile under the far side swaps into the hole and nothing on the path moved
- [ ] Large onto a block of smalls: the smalls swap into the large's hole with offsets intact
- [ ] Near side rings the target and release groups; the same on a folder tile adds to it
- [ ] Blocked spot shows and a release there snaps home with nothing else changed
- [ ] Escape mid-gesture restores every tile; holes persist after a move and a reload
- [ ] Touch: the same row push and the same near-side group under touch input
- [ ] Timing proven per-frame in Playwright only; no timer claims from the Browser pane
- [ ] e2e green on both viewports
