# 02: Nav Rail Scroll

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The shared Nav Rail scrolls its tab list when the list is taller than the rail (spec Q15). The collapse toggle stays pinned at the bottom. One fix in the shared component, so the World Editor and Community Creations rails get it too, and so does the Memories rail that ticket 04 adds.

The mobile Sections bar already scrolls (main `9e8726f04`); match its feel, including overscroll containment.

## Acceptance criteria

- [ ] With more tabs than fit, the rail's tab list scrolls and its last tab is reachable; verified by a DOM read of the list's scroll height against its client height, expanded and collapsed.
- [ ] The collapse toggle stays at the bottom of the rail and is visible while the list scrolls.
- [ ] A rail whose tabs fit looks and behaves as before, in the World Editor and Community Creations.
- [ ] Frames `.scratch/frames/nav-rail-scroll-expanded.png` and `.scratch/frames/nav-rail-scroll-collapsed.png`, dark theme, a short desktop window (1280×600).
- [ ] A changelog fragment under Fixed: the rail scrolls on short windows.
