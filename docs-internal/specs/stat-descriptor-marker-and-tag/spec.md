# Spec: Stat Descriptor Bar — Honest Start Marker & Non-Clipping Threshold Inputs

Status: ready-for-agent

## Problem Statement

Two display defects in the World Editor's Stat Descriptors section undermine an author's trust in what they're reading:

1. **The start marker lies about where the stat starts.** The tick under the coverage bar is clamped away from the container edges so its caption ("starts at N") fits, which means for a stat starting at or near min/max the tick points at the wrong spot on the bar. Worse, the clamp assumes a short caption — a wider one ("starts at 200") still clips at the container edge. The tick also reads as a technical hairline rather than a friendly pointer.

2. **Large stat ranges make threshold values unreadable.** The threshold input wears its unit tag ("of 100999") inside its right edge via padding, but the input's width is fixed. A long tag eats nearly the whole box, clipping the author's own typed value down to a single glyph.

## Solution

1. The start marker becomes an arrow (▲-style pointer) that always sits at the stat's true starting position on the bar — it never moves to accommodate its caption. The caption instead slides along under it: centered when there's room, hugging the container edge when the arrow is near min or max, never clipped.

2. The threshold input's width grows with its unit tag instead of the tag consuming the value's space, and tags for large maxes render compactly ("of 101k") so the column stays tidy. The exact max remains visible in each row's "covers X – Y" caption.

## User Stories

1. As a world author, I want the start marker to point at the exact spot on the coverage bar where my stat begins, so that I can trust the bar as a picture of turn one.
2. As a world author, I want the start marker's caption to stay fully readable at any start value, so that I never have to guess a clipped number.
3. As a world author with a stat starting at min, I want the arrow at the very left edge of the bar with its caption tucked inside the container, so that edge cases read as cleanly as middle cases.
4. As a world author with a stat starting at max, I want the same behavior mirrored at the right edge, so that the marker is symmetric in its honesty.
5. As a world author, I want the marker to look like a casual pointer rather than a technical tick, so that the editor feels approachable.
6. As a world author of a large-range stat (e.g. max 100999), I want to read the threshold values I typed, so that I can audit my bands without opening each field.
7. As a world author of a large-range stat, I want the unit tag abbreviated ("of 101k"), so that the threshold column doesn't balloon.
8. As a world author of a small-range stat, I want the tag to render exactly as today ("of 100"), so that familiar worlds look unchanged.
9. As a world author using % of Max thresholds, I want the "%" tag and input width unchanged, so that the percent path is untouched by this work.
10. As a world author typing a new threshold in the "Up to" row, I want the same width and tag behavior as existing rows, so that the add row matches.
11. As a world author reading a compacted tag, I want the precise max still discoverable in the row's "covers X – Y" caption, so that abbreviation costs no information.
12. As a world author resizing the editor panel, I want the caption clamp to re-derive from the current container width, so that a narrow panel never re-introduces clipping.

## Implementation Decisions

- All new logic lands as pure functions in the descriptor geometry library (`statDescriptorGeometry`), the single seam the coverage bar already reads from. Three additions:
  - **Compact tag formatting.** The unit-tag function gains compact rendering for raw-unit maxes at or above 10000 (5+ digits), using `Intl.NumberFormat` compact notation. Below the cutoff, output is byte-identical to today. Percent stats are unaffected.
  - **Caption offset clamp.** A pure function taking the marker's center position, the caption's rendered width, and the container width, returning the horizontal offset that centers the caption under the marker while keeping it fully inside `[0, containerWidth]`. A caption wider than the container pins to the left edge.
  - **Threshold input width.** A pure function from tag string to CSS width: a fixed value budget (~4.5rem) plus the tag allowance already computed for padding. Small tags reproduce today's 7rem; long tags widen the box.
- The component splits the marker into two absolutely positioned elements: the arrow at the exact fractional position (no clamp), and the caption whose offset comes from the clamp function, fed by a layout-effect measurement of caption and container widths — the same measure-then-style idiom the bar's band labels already use. Re-measures on start value, range, and container resize.
- The arrow is a small upward-pointing triangle (CSS borders or an inline SVG — implementer's choice), replacing the 2px hairline, in the same foreground color.
- No changes to stored world or save data shapes; this is display-only.
- No changes to band semantics, threshold conversion, or the prompt's band lookup.

## Testing Decisions

- Good tests here assert external behavior of the pure geometry functions — given inputs, the returned string/number — never the component's internal styling mechanics.
- All three new functions are tested in the geometry library's existing test file, alongside the current tag and span tests (the prior art).
- Cases that must be covered: tag compaction boundary (9999 stays exact, 10000 compacts), percent tag unaffected, clamp at left edge / right edge / center / caption-wider-than-container, width floor for short tags and growth for long ones.
- jsdom cannot measure real layout, so the component's measurement wiring is verified in the live preview (dev-router), not asserted in unit tests.

## Out of Scope

- Any change to how thresholds are stored, converted, or read by gameplay or prompts.
- Dragging the marker or editing the start value from the bar.
- Compacting the numbers inside the "covers X – Y" captions.
- The Bench's band rules and lens displays.

## Further Notes

- The 2.5rem clamp being removed was compensating for a single-element marker; once tick and caption separate, no magic constant remains.
- Visual verification should check both unit modes, both themes, and the two screenshot scenarios (farm stat starting at 0; space stat with max 100999 starting at 200).

## Comments

- Implemented 2026-08-18. All three functions landed in the geometry library and are mutation-tested; the component verified live via the dev-router (arrow at exact fraction for start 0 and 200/100999, caption pinned in-bounds, `of 101k` tag, no input overflow). Coverage: 100% lines, 93.1% branch (remaining branches are pre-existing min/max defaults).
