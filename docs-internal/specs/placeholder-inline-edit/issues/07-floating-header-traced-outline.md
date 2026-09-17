# 07: Floating Header and Traced Outline

Status: ready-for-human
Base: 2530b8df
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Type: task
Spec: ../spec.md (Header and shape)

Model rationale: a measurement-driven layout port with many geometric edge cases and a user-approved look to match.

## What to build

Open values look the way the prototype's `slot-float-shape` treatment looks. The value text stays inline
where the chip was. A small header floats above the value's first line as a tab. One traced outline wraps
every line of a wrapped value.

- The header sits above the first line fragment, flush as a tab: the outline's top-left corner is square
  under it. The header's bottom corners are square where the first line runs beneath and rounded past the
  line's ends.
- An empty inline spacer at the value's start pushes that line down, so the header never covers the line
  above and adds no line-break opportunity.
- Only the header of the value that holds the caret is full: name, value label, chevrons. Every other
  header is compact: name and chevrons, label as a hover title. Collision never drives compaction.
- Headers lay out in one editor-wide pass after every update, on resize, and whenever a header resizes.
  A header stays inside the editor's box. When two meet on one line, the left one slides to the right end of
  its own value's first line if free, then the right one tries the same, and as a last resort the left one
  is pushed away.
- The outline is an overlay traced from the value's line fragments. Consecutive lines join only where they
  overlap horizontally; a wrap with no overlap splits the shape. It redraws when any chip opens, closes or
  changes, not only its own.
- The layout keeps a few pixels on either side of the value so the outline never covers a neighbor's space.
- The value that holds the caret shows a stronger ring and fill, a brighter header, and a caret in the
  chip's color. The state comes from the selection, not from `:focus-within`.
- Colors come from the chip's identity color. Both themes. Reduced motion respected.
- The look follows the design guide and showcase. The user approves the visual pass in app context,
  mobile form included.

## Acceptance criteria

- [x] A one-line value shows a tab header above it and one rounded outline.
- [x] A value that wraps across three lines shows one contiguous outline.
- [x] A wrap whose lines do not overlap horizontally shows two shapes.
- [x] The caret's value shows the full header; every other open value shows the compact one with a hover title.
- [x] Two headers on one line never overlap, including after a chevron step to a longer label.
- [x] No header leaves the editor's box at the left or right edge.
- [x] The line above a value is never covered, and the spacer adds no wrap point.
- [x] Closing or changing one value redraws the other values' outlines.
- [x] Verified in light and dark themes and with reduced motion, from static frames.
- [x] Playwright covers header seating, compaction, slide and push, and the outline split.
- [x] Changelog In-Progress entry added. Four gates green.

## Handover

The visual pass still needs the user's approval in app context, mobile form included, which is the one
line of "What to build" this ticket cannot close on its own. Everything else is built and evidenced:
22 Playwright cases (desktop and mobile) and 19 unit cases on the geometry module, with both suites
mutation-checked. The changelog lines for this ticket sit in commit b57fa434, swept in with a neighboring
session's work on the shared file.
