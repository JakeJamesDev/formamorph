# 05: Header Motion And Carried Face

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

Model rationale: the carried face is a small swap to an existing component. The header needs a second
frozen clone on the fly-out and clean-up that matches the board's, which is the part that needs care.

## What to build

Two fixes the player saw after ticket 04.

**The folder header animates.** The header (**Library**, the name field, **Prompts**) appears at the first
frame today. For a folder on the top row it sits against the tile the camera flies into. It now slides
down and fades in at the reveal point, with the left-out members. On a fly-out it slides up and fades out
first. The board does not jump, because the header's space is reserved from the first frame.

**The carried folder tile shows the cropped face.** A dragged folder still shows the old 2×2 mosaic under
the pointer. It now draws the same face as the tile.

No prototype covers the header. The spec's Implementation Decisions hold both rules; read them first.

Decisions from the spec:

- In the fly-in sense the header holds zero opacity and sits one header height above its place until the
  reveal point, then slides down and fades to rest on the camera's easing.
- The header mounts at the swap as it does today. Do not delay the mount: the `d` term depends on the
  header's space being there when the hook measures.
- On a fly-out the header unmounts at the swap. The hook freezes it before the swap, as it does the
  board: a clone in a fixed overlay at the header's old rectangle, played in reverse.
- The header overlay clips to the header's rectangle, so the slide never covers the toolbar or the tabs.
- The header takes no pointer input during the motion.
- Every guard that gives the instant swap gives the header with no motion.
- The carried tile draws the face component from the same region function as the tile, at the overlay's
  size, in the grid layout. It keeps the overlay's rules: half opacity, no shadow, no ring, no name bar.
  The detailed layout keeps the mosaic.

## Acceptance criteria

- [ ] On an animated open the header is at zero opacity and raised until the reveal point, and at rest at the end
- [ ] On a fly-out a frozen header plays the same keyframes in reverse, and no header clone remains afterwards
- [ ] The board's first-frame position is the same as before this ticket; the camera unit test and the scroll restore still pass
- [ ] The header slide is clipped to the header's rectangle
- [ ] The header takes no pointer input during the motion, and the name field is usable as soon as the motion ends
- [ ] Under a drag, reduced motion, the detailed layout, and an unmeasurable tile, the header appears with no motion
- [ ] A back during a fly-in, and an open during a fly-out, leave one header, no clone, and no inline style on it
- [ ] A dragged folder tile in the grid layout draws the face's members under the pointer, not four mosaic cells; a jsdom test pins it and fails when the mosaic returns
- [ ] The carried tile keeps half opacity with no shadow, ring, or name bar; the detailed layout keeps the mosaic
- [ ] The library drag parity and library tiles suites stay green
- [ ] Static checks in the preview use paused frames or DOM reads, not watched motion
- [ ] `docs/Changelog.md` In-Progress entry for the folder zoom is corrected in place, with no new churn entry
- [ ] Four gates green; no export-shape change
