# 04: Cropped Face And Staged Reveal

Status: ready-for-human
Status note: built. The two paused-frame criteria stay open for ticket 05: jsdom has no layout engine, so the tests here pin the keyframes the hook asks for rather than what a frame shows. As a check, the frames were sampled by hand in the live app, driving the animations' own clock because the preview pane holds `document.hidden` true and freezes every animation at time 0. Over 28 frames the folder tile's rectangle in the outer layer matched the region's rectangle in the inner layer exactly, and no frame showed the clip open or a left-out member while the library board had opacity. That is evidence, not the test the criteria ask for.
Base: ad22ccee
Blocked by: 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: the change crosses the face, the camera function, and the keyframes of built code, and
the lock invariant must hold for a region narrower than the board. Two earlier reveal designs failed on
screen, so the staging needs care.

## What to build

The full-width miniature from ticket 01 is not legible. The folder tile now shows the **cropped face**:
the top-left region of its own board at a readable scale, whole tiles only, with a `+N` badge for the
members it leaves out. The camera from tickets 02 and 03 zooms by the region's width instead of the
board's. The left-out members wait until the library board is gone, and then they all fade in together.
A fly-out plays the same steps in reverse.

The prototype on branch `prototype/folder-fly-in` (`/?variant=A&seed=1&face=crop`) is the primary source.
Rewrite it. The spec's Implementation Decisions hold the region formula, the whole-tile rule, and the
staged reveal; read them first.

Decisions from the spec:

- One pure region function gives the region's columns, width, and height, and the left-out members. The
  face and the camera both read it, so they cannot drift apart.
- The cap is `tileSpan * 2` base-cell columns: one, two, or four medium columns for a small, medium, or
  large folder tile. The region is never narrower than the corner member.
- The face draws whole tiles only. A member that a region edge would cut is a left-out member.
- The camera scale is `regionWidth / tileWidth`. The rest of the camera function does not change.
- The outer layer reaches zero opacity at 60% progress, the reveal point.
- The inner clip is the region rectangle, constant in board space. It holds until the reveal point and
  opens in one step. It is not a wipe.
- Left-out members hold zero opacity until the reveal point and then fade to 1 at one shared value.
- The member-title fade and the name-bar fade from ticket 03 do not change.
- The crossfade on the folder stays as the spec records it.

## Acceptance criteria

- [x] A unit test covers the region function: fit to the used columns, the cap for each tile size, the corner term, and the left-out list with a tile that an edge would cut
- [x] The face draws every member that fits whole, at the cell and span the open folder gives it, and draws no left-out member
- [x] The `+N` badge shows the left-out count and is absent when the count is zero
- [x] A folder whose members use fewer columns than the cap fills the tile width
- [x] A large member on a small folder tile shows whole
- [x] A filtered view builds the region from the members the filter passes
- [x] The camera unit test holds the lock for a region narrower than the board and for a full-width region, and still fails when the `d` term is removed
- [ ] Paused frames show no part of the inner layer past the tile's frame while the outer layer has any opacity — **ticket 05**; jsdom has no layout engine, so the keyframes are pinned here instead
- [ ] Paused frames after the reveal point show every left-out member at the same opacity — **ticket 05**, same reason
- [x] The fly-out plays the same keyframes in reverse; the guards, cleanup, and scroll restore from tickets 02 and 03 still pass
- [x] The jsdom tests from ticket 01 are updated to the cropped face, and each still fails when its behavior is broken
- [x] `docs/Changelog.md` In-Progress entries from tickets 01 and 03 are corrected in place, with no new churn entry
- [x] Four gates green; no export-shape change

## Comments

### The corner member is cropped a few percent, not cut

The region's height is the tile's own shape grown to the region's width, so a member whose span differs
from the tile's misses that shape by the difference between their two height-to-width ratios. The 6%
slack covers the ordinary near-misses. It does not cover the corner member of a small folder tile, where
a span-4 member against a span-1 tile is 7% to 12% over depending on the board's width.

The region is built around that member, so it is never left out: leaving it out gives an empty face,
which user story 37 rejects. It is drawn instead, and the tile's own frame crops its bottom edge.
Measured in the live app at 1440 px: a large member on a small folder tile drew 92 px tall in an 87 px
tile, so 5 px were cropped. Every other member on every face measured inside the tile's box.

### For ticket 05: measure the clip, not the member's box

The inner clip is the region rectangle, so the bottom sliver of an exempt corner member shows when the
clip opens at the reveal point. That is accepted. The "no part of the inner layer shows past the tile's
frame" guard must therefore measure the clip rather than the member's box, or it fails on a small
folder tile whose corner member is large. Ruling from the spec session, `f933b766`.
