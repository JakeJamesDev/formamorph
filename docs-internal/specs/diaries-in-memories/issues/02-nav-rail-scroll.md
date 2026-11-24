# 02: Nav Rail Scroll

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The shared Nav Rail scrolls its tab list when the list is taller than the rail (spec Q15). The collapse toggle stays pinned at the bottom. One fix in the shared component, so the World Editor and Community Creations rails get it too, and so does the Memories rail that ticket 04 adds.

The mobile Sections bar already scrolls (main `9e8726f04`); match its feel, including overscroll containment.

## Acceptance criteria

- [ ] With more tabs than fit, the rail's tab list scrolls and its last tab is reachable; verified by a DOM read of the list's scroll height against its client height, expanded and collapsed. Collapsed read in the World Editor with the rail capped at 300px: viewport 391 over 252, last tab reachable. Expanded not read: the preview pane auto-collapses the rail.
- [x] The collapse toggle stays at the bottom of the rail and is visible while the list scrolls. DOM read: the toggle's bottom stays inside the rail while scrolled to the end (collapsed).
- [ ] A rail whose tabs fit looks and behaves as before, in the World Editor and Community Creations.
- [ ] Frames `.scratch/frames/nav-rail-scroll-expanded.png` and `.scratch/frames/nav-rail-scroll-collapsed.png`, dark theme, a short desktop window (1280×600).
- [x] A changelog fragment under Fixed: the rail scrolls on short windows. `docs-internal/changelog.d/diaries-in-memories-02.md`.

## Landed

**Not verified**

- Expanded-rail scroll read: the preview pane auto-collapses the rail; only the class test covers it.
- Community Creations: not opened; it shares the component.
- A fitting rail looks as before: the World Editor read showed the list fitting (391 over 391) with unchanged 39px rows; no frame compared.
- Both frames: the Browser pane returned blank screenshots.

**For you**

- Open the World Editor in a window short enough for the tabs to overflow, expanded and collapsed: the list scrolls, the toggle stays at the bottom, and the edge bar on the active tab is not clipped.
