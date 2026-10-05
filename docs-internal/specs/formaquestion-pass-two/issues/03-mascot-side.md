# 03: Mascot side by wider gap

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The mascot stands on the side of the chat with more free screen.

- The layout module returns the side from the wider free gap; a tie keeps the current side. The reader piece takes the other side.
- The mascot piece and the head on the pill follow the side. Dragging the window across the middle flips once.

Spec: Q12; Implementation → Window layout module, Window.

Recommended model rationale: one rule in a pure module and two render sites.

## Acceptance criteria

- [ ] Layout tests: left near the right edge, right near the left edge, a tie keeps the side, the reader takes the other side.
- [ ] The pill head renders at the mascot's end on both sides.
- [ ] Playwright: the flip while the column is dragged across the middle.
- [ ] The four gates are green.
