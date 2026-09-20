# 05: Header Motion And Carried Face

Status: ready-for-human
Base: 4aea4283
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

- [x] On an animated open the header is at zero opacity and raised until the reveal point, and at rest at the end
- [x] On a fly-out a frozen header plays the same keyframes in reverse, and no header clone remains afterwards
- [x] The board's first-frame position is the same as before this ticket; the camera unit test and the scroll restore still pass
- [x] The header slide is clipped to the header's rectangle
- [x] The header takes no pointer input during the motion, and the name field is usable as soon as the motion ends
- [x] Under a drag, reduced motion, the detailed layout, and an unmeasurable tile, the header appears with no motion
- [x] A back during a fly-in, and an open during a fly-out, leave one header, no clone, and no inline style on it
- [x] A dragged folder tile in the grid layout draws the face's members under the pointer, not four mosaic cells; a jsdom test pins it and fails when the mosaic returns
- [x] The carried tile keeps half opacity with no shadow, ring, or name bar; the detailed layout keeps the mosaic
- [x] The library drag parity and library tiles suites stay green — red at `Base:` for reasons outside this ticket, fixed in `63ffa392`, and green with this change on top
- [x] Static checks in the preview use paused frames or DOM reads, not watched motion
- [x] `docs/Changelog.md` In-Progress entry for the folder zoom is corrected in place, with no new churn entry
- [x] Four gates green; no export-shape change

## Comments

Review against `Base: 4aea4283` ran on both axes. Folded in:

- The face is drawn by one `renderFace` call that the tile and the drag overlay both use, so the two
  pictures cannot drift apart by a missed edit.
- The carried face reads the board's own `folderFaces` map alone. The second source it had was
  unreachable: a folder never stands inside a folder, so a carried folder is always on the library board.
- The header branch reads the frozen copy first, which settles which header it is without asking the
  direction three times.
- Two comments that claimed more than the code did were corrected.
- The interruption tests now pin that the live header carries no inline style afterwards, and the
  fly-out guard cases pin that nothing of the header is left. The fly-in guard check bites; the fly-out
  guard one is defensive, because a guarded run does nothing at all.

Kept, against the spec's letter: the carried tile takes the folder tile's own `border-2 border-border`.
The spec lists "no shadow, no ring, no name bar", and a border is none of those. The face is drawn to
sit under that frame, so without it the face bleeds past the carried tile's rounded corner. The test now
asserts the border on both the tile and the carried copy rather than passing by omission. Say so if the
frame should go and the face should be inset instead.

The two library Playwright suites were red at `Base:` — 29 of 40 failing, reproduced on a clean tree at
4aea4283. I guessed the cropped face had broken their `img` `alt` locators. That was wrong: the fix in
`63ffa392` found three unrelated causes and records that every tile the suites read still carries its own
name. Both suites pass with this change on top.

A second pass fixed the same clipping fault on the other layer. The folder board grows out of a tile that
stood in the strip the header now occupies, and the scroll viewport clipped its top rows off along a
straight edge for the whole motion. Measured: the tile sat at y 80, the viewport started at y 128, and 48px
of the arriving board was cut. The viewport's clip now reaches back to the board area for a fly-in, which
is the one direction that needs it. Across every sampled frame the board is cut by nothing and reaches
past nothing.

