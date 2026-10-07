# 04: Game Debug Search

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: one box with an existing right-aligned control group; adding a cell and a test is contained.

## What to build

The game debug panel's search box gains the **Clear Search** X as the first cell of its existing right-aligned group, before the "N of M" counter and the previous and next controls (Q7). Clearing empties the box, resets the hit position, and focuses the box.

Changelog: none; 01's lead covers it (Q13).

## Acceptance criteria

- [ ] The X shows while the box holds text and sits before the counter.
- [ ] Clearing empties the box, the counter disappears with the search, and focus lands on the box.
- [ ] One test that the X clears the box; no existing assertion is weakened.
- [ ] Four gates green.
