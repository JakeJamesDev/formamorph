# 02: Paint the window before the cards

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

One component's render order, but the empty-state flash is an easy regression to miss.

## What to build

Spec Q8. Clicking Community Creations shows its window at once. The card grid renders after the shell paints, as a transition, for cached and fresh rows alike. The reader never sees an empty grid or the "no results" state while cards are pending.

## Acceptance criteria

- [ ] The window shell commits before the card grid on every open.
- [ ] No "no results" or empty-grid frame shows while rows exist but have not rendered.
- [ ] Scroll, search input, and close respond while the grid renders.
- [ ] A render test proves the shell commits first and fails when the grid renders in the same commit.
- [ ] Harness numbers before and after, at 1× and 4×, are recorded under `## Comments`.
