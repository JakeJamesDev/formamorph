# 03: Test Code And Templates Per Box

Status: ready-for-human
Status note: Done in 04290a0c. Two calls beyond the ticket, both flagged: the menus are strictly disjoint, and the before box tests on the opening-turn clock rather than the after box's one-hour turn. The template pack .json gains a timing field at pack version 1.
Base: 9b964be4
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Editor work on a panel that already has one Test Code button and one template menu; this doubles them with a timing. Sonnet at medium effort.

## What to build

Each editor on the Code tab has its own Test Code button and result area. Test Code on the before box runs it with `delta` at zeros; Test Code on the after box runs as today. Editing one box clears only that box's result.

Templates carry a timing. The before menu offers setup templates: pin a placeholder, switch a trait, set a value on the opening turn. The after menu keeps the regen, clamp, and react-to-the-AI templates. The template tests cover both menus. The guide and the in-app help show the turn order once and describe each box beside it.

## Acceptance criteria

- [x] Each editor has a Test Code button; the before box's run reads zeros for `delta` and reports its own writes
- [x] A change in one box clears that box's result and leaves the other's
- [x] The before menu and the after menu list different templates, and every template names a timing
- [x] A before-box template inserts into the before box and runs under Test Code there
- [x] Guide and help show the turn order and both boxes
- [x] Four gates green; graph updated

## Blocked by

- 02 — The Before the AI Box
