# 03: Fly-Out On Back

Status: ready-for-human
Base: 0ccf32c1
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
- Member title text fades on the camera's own easing, not linear time, so the fade tracks the board's
  size. Gone once the board has receded past a quarter of the camera range. This is fly-out only.
- The folder tile's name bar comes back in the last 12%.
- A new open or back during the motion finishes the running one first.
- A folder disbanded while it is open drops back to the library with no animation.
- The crossfade on the folder stays as the spec records it. Do not remove it.

## Acceptance criteria

- [x] **Library** runs the fly-out in the grid layout and lands on the folder tile
- [x] The library scroll offset after the fly-out equals the offset before the fly-in
- [x] Member title text fades on the camera easing, reaches zero once the board passes a quarter of the camera range, and stays at full opacity during a fly-in
- [x] A back during a fly-in, and an open during a fly-out, leave one board, no overlay, and no inline transform
- [x] A disbanded open folder returns to the library with no animation and no overlay
- [x] The guards from ticket 02 apply to the fly-out
- [x] `docs/Changelog.md` In-Progress entry added for the folder zoom
- [x] Four gates green; no export-shape change

## Comments

### Built

`710ad2ae`. `useFolderFlyIn` is now `useFolderZoom`: one keyframe set, played with
`direction: 'reverse'` on the way out. The hook always freezes the board that is leaving, so the clone
is the outer layer on a fly-in and the inner layer on a fly-out.

The fly-out has no tile on screen at click time, so it measures the tile in the layout effect, after
the scroll restore has moved it. The test records the scroll offset at each tile measurement rather
than the resulting transform, so it names the ordering rather than mirroring the camera math.

`data-tile-title` on `OverlayTitle` is the seam for the member-name fade. Every tab's grid tile goes
through that one element.

Landing a running camera moved to the top of both handlers. A tile measured through a camera that
still holds an inline transform is not where it looks.

### Reviewed

Two axes against `Base:`. Standards found two new lint-disables, which the repo bar forbids; fixed by
making `snapshot` a `useCallback`, so both dep arrays are honest. `live` renamed to `latest`.

Spec raised one substantive point: on a fly-out the 8x layer is the live grid inside the scroll
viewport, not the clipped overlay, so the spec's clipping guarantee rests on the viewport's own
overflow. Measured in Chrome on the real library rather than left open:

| Check | Reading |
| --- | --- |
| Scroll extent under the transform | `scrollWidth` 1248 -> 4648, `scrollHeight` 568 -> 665, both released on cleanup |
| Painting | Viewport computes `overflow: hidden scroll`, so the blown-up board is clipped to the board area |
| Scrollbar | `scrollbar-width: none`, zero gutter, and Radix renders no scrollbar element here, so nothing flashes |
| Parked scroll offset | Survives an 8x transform that grows `scrollHeight` 1000 -> 7400 and releases it |

So the mechanism is real and the consequence is not. No code change. **Ticket 04 should assert the
clip per frame**, because the guarantee now depends on that viewport `overflow` staying as it is.

### Changed after review

The member-name fade no longer runs on linear time. The spec first put it in the first 15% of the
fly-out, which read as a beat that kicks the motion off rather than as text lost to distance. It now
keeps the camera's easing, so its offsets are read against the board's size: a name is gone once the
board has receded past a quarter of the camera range, about 308 ms into the 420 ms trip.

| Board size when the name is gone | zoom 4 | zoom 8 |
| --- | --- | --- |
| Inner layer scale at camera 0.25 | 0.44 | 0.34 |

The folder name bar keeps linear time. It is not on the board, so the clock is the right measure for
it. The spec's Implementation Decisions now split the two rules.

### Not covered here

Motion itself. The spec assigns per-frame sampling to ticket 04: "Motion must be verified with
Playwright sampling, not in the preview pane."
