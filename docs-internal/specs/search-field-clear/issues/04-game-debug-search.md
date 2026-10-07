# 04: Game Debug Search

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: one box with an existing right-aligned control group; adding a cell and a test is contained.

## What to build

The game debug panel's search box gains the **Clear Search** X in its existing right-aligned group, after the "N of M" counter and before the previous and next controls (Q7 revised at review). The group shows for any text, whitespace included (Q3). Clearing empties the box, resets the hit position, and focuses the box.

Changelog: none; 01's lead covers it (Q13).

## Acceptance criteria

- [ ] The X shows while the box holds text, whitespace included, and sits after the counter.
- [ ] Clearing empties the box, the counter disappears with the search, and focus lands on the box.
- [ ] One test that the X clears the box; no existing assertion is weakened.
- [ ] Four gates green.
