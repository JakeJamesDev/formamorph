# 05: Dialog Close Ring

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Recommended model rationale: one class change in the shared dialog, plus a guard test.

## What to build

A dialog opened with the mouse shows no outline on its close button (Q9). Focus still lands on the X when the dialog opens. The ring shows only for keyboard focus, so a dialog opened from the keyboard still shows where focus is.

Changelog fragment: a Fixed entry stating that dialogs no longer open with an outline around the close button.

## Acceptance criteria

- [ ] Opening a dialog with a click focuses the X and draws no ring.
- [ ] Tabbing to the X, or opening the dialog from the keyboard, draws the ring.
- [ ] A test asserts the ring is keyboard-only. Prove it bites by restoring the any-focus ring.
- [ ] Changelog fragment written.
- [ ] Gates green.

## Blocked by

- None (can start immediately)
