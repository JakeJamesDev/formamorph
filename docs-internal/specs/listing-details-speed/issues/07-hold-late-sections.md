# 07: Hold space for late sections

Status: ready-for-human
Base: 859c77f1
Status note: ruled Q11 (option c): Linked Content and Compatible Worlds sit at the end of the left column, with no placeholder and no reserved space.
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Small layout change.

## What to build

Spec Q5 and Q11. Linked Content and Compatible Worlds in the details window do not shift the layout when the details answer arrives. They sit last in the left column, so a late arrival pushes nothing above it.

## Acceptance criteria

- [x] The placeholder form is ruled in the spec before work starts (Q11).
- [x] The left column does not move when the details answer lands, for a listing with and without those sections.
- [x] A test at the details window seam covers both cases.
