# 01: Place the Mascot below the chat

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

With a short help chat, the Mascot stands under the column as one card. With a tall chat she stands beside it as today. No new control yet: this device value defaults to Auto.

- The window layout gains a Position input, Beside / Below / Auto, and one exported cap constant, 75% of the window height. Auto resolves to below at or under the cap and beside above it, snapping at the line. Beside is today's layout.
- Below is a column variant: the column over the Mascot, the group's bottom edge at the screen margin. The column's height clamps to the cap on every resize; its vertical position clamps so she fits under it. Auto scale fills the room from the column's bottom edge to the screen margin at her aspect; a percent scale clamps to that room. The column never moves for her.
- The Lookup reader stays beside the column at the column's height. Both chromes draw the two variants; the head view is unchanged. The mobile sheet is unchanged.
- A fresh window opens at 60% of the window height.
- Position is stored per device beside Scale, with the same read-and-write pair and the same fallback to Auto.

Spec: Q1, Q2, Q3, Q4, Q6, Q7, Q8; Implementation → Window layout module, Window.

Recommended model rationale: a pure layout with two variants and four interacting clamps, plus the window's drag and resize paths.

## Acceptance criteria

- [ ] Layout tests: Below puts the group's bottom edge at the screen margin and her under the column at the room's height; Auto resolves below at the cap and beside one pixel over; a resize past the cap under Below returns the cap; a percent scale below clamps to the room; the reader keeps its side and height; the default box is 60% of the viewport height within the clamps.
- [ ] Store tests: round trip; damaged and blocked storage return Auto.
- [ ] Each clamp guard is proved once by reinstating the bug.
- [ ] In the live window, a short chat draws her below and a chat dragged past the cap draws her beside, in both chromes.
- [ ] The four gates are green.
