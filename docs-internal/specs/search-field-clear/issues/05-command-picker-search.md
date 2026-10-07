# 05: Command Picker Search

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: cmdk owns Enter and arrow handling on its root, one picker's input is uncontrolled, and the ticket must prove a focusable X would break selection before shipping the mouse-only one.

## What to build

The shared command input used by the multi-select, breadcrumb picker, trait requirements, variable menu, and stat code templates gains the **Clear Search** X inside its input wrapper. The X is mouse-only with `tabIndex -1` so Enter keeps selecting the highlighted item (Q9). For the uncontrolled breadcrumb picker the X reads the search through cmdk's command-state hook and clears it through the input.

Changelog: none; 01's lead covers it (Q13).

## Acceptance criteria

- [ ] All five pickers show the X while the search holds text and clear on select, with focus back in the input.
- [ ] Enter still selects the highlighted item while the X is on screen.
- [ ] A test proves the guard bites: it fails when the X is focusable and passes with `tabIndex -1`.
- [ ] The breadcrumb picker clears without becoming a controlled input elsewhere.
- [ ] Four gates green.
