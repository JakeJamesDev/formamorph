# 03: Fly-Out On Back

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Model rationale: the geometry and the keyframes exist after ticket 02. The work is the reverse direction,
scroll restore order, and interruption, which need care but little new design.

## What to build

**Library** in the folder header plays the fly-in in reverse: the folder board shrinks into the folder
tile while the library board zooms back to rest and fades in. The library returns to the scroll position
the player left.

Decisions from the spec:

- A fly-out plays the fly-in keyframes with `direction: 'reverse'`. The clone is now the inner (folder)
  layer and the real grid is the outer (library) layer.
- A fly-in saves the library scroll offset. A fly-out restores it before it measures the folder tile.
- Member title text fades out in the first 15% of the fly-out, on linear time. This is fly-out only.
- The folder tile's name bar comes back in the last 12%.
- A new open or back during the motion finishes the running one first.
- A folder disbanded while it is open drops back to the library with no animation.
- The crossfade on the folder stays as the spec records it. Do not remove it.

## Acceptance criteria

- [ ] **Library** runs the fly-out in the grid layout and lands on the folder tile
- [ ] The library scroll offset after the fly-out equals the offset before the fly-in
- [ ] Member title text reaches zero opacity within the first 15% of the fly-out and stays at full opacity during a fly-in
- [ ] A back during a fly-in, and an open during a fly-out, leave one board, no overlay, and no inline transform
- [ ] A disbanded open folder returns to the library with no animation and no overlay
- [ ] The guards from ticket 02 apply to the fly-out
- [ ] `docs/Changelog.md` In-Progress entry added for the folder zoom
- [ ] Four gates green; no export-shape change
