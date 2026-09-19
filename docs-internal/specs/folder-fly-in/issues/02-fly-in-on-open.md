# 02: Fly-In On Open

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: transform math with a lock invariant, DOM cloning around a React commit, and cleanup that
must leave nothing a dnd-kit measurement can read. Errors here are subtle and visual.

## What to build

A click on a folder tile, or **Open Group** in the context menu, zooms into the tile. The library board
zooms toward the folder tile and fades out. The folder board starts inside the tile at tile scale and grows
to full size. The two layers move as one camera, so the miniature becomes the board with no jump. The
motion takes 420 ms.

The prototype on branch `prototype/folder-fly-in` (variant A, 1×) is the primary source. Rewrite it.

Decisions from the spec:

- A hook owns the transition. The grid hands it the grid element, the tile elements, the open folder id,
  the setter, and a busy flag. The open handlers call the hook; the disband effect keeps the direct setter.
- Before the swap the hook clones the grid element. After the swap it puts the clone in a fixed overlay
  that has the scroll viewport's rectangle and clips to it. The folder board opens at scroll top.
- **Camera geometry is one pure function** (from the prototype). With `s = outerWidth / tileWidth`, `o`
  the tile's offset in the outer layer, `i` its offset in the inner layer, and `d` the inner layer's origin
  minus the outer layer's origin:

  ```
  outer: translate(0, 0) scale(1)   ->  translate(d - o*s) scale(s)
  inner: translate(i) scale(1/s)    ->  translate(0, 0) scale(1)
  ```

  Both use `transform-origin: 0 0`, one duration, one easing. The `d` term is required: a scrolled library
  and the folder header both move the inner origin away from the outer origin.
- Timing: 420 ms, `cubic-bezier(0.45, 0, 0.15, 1)`, Web Animations API, no new dependency.
- Opacity: outer layer 1 → 0 at 75% progress; folder tile inside the outer layer 1 → 0 at 30%; inner layer
  0 → 1 at 35%. Inner clip: from the tile's height at tile corner radius to no clip.
- The folder tile's name bar fades 1 → 0 in the first 12%, on linear time.
- Member titles stay at full opacity for the whole fly-in.
- Write the keyframes so that ticket 03 can play them in reverse.

## Acceptance criteria

- [ ] A click on a folder tile and **Open Group** both run the fly-in in the grid layout
- [ ] A unit test on the pure camera function shows the tile's image under the outer transform equal to the inner rectangle at progress 0, 0.5, and 1, with a scrolled outer layer and a header offset; the test fails when the `d` term is removed
- [ ] The zoom is clipped to the scroll viewport and never covers the toolbar or the tabs
- [ ] No animation runs while a drag is active, under `prefers-reduced-motion: reduce`, in the detailed layout, or when the folder tile cannot be measured; each case gives the instant swap
- [ ] The scroll viewport takes no pointer input during the motion
- [ ] After the motion the overlay is removed, every inline style the hook set is restored, and the grid has no inline transform
- [ ] The folder board opens at its top
- [ ] Works for small, medium, and large folder tiles, and on the two-column phone grid
- [ ] Works on all four library tabs
- [ ] Static checks in the preview use paused frames or DOM reads, not watched motion
- [ ] Four gates green; no export-shape change
