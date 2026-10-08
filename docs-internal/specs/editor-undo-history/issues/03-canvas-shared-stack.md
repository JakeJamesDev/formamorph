# 03: The Locations Canvas records through the shared stack

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a migration with a clear target; the module and recorder already exist. Care is needed around the module-level handle and the showcase.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

The canvas's own stack and chord reader go. A multi-drag or an Auto Arrange on the canvas is one Step in the shared history, undone by Ctrl+Z from anywhere in the editor and shown in the list panel afterwards, as today (Q2, stories 6, 34, 37).

- The canvas's whole-slice commits carry a merge key when they should merge: travel hints as today, and keyboard nudges so a run of nudges follows the pause rule (Q19).
- The module-level stack handle keyed by world id goes; the provider holds the stack. The Design System showcase's canvas gets an isolated instance so it never records into an open world.
- The canvas's keyboard handling for Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z is removed; the shared listener serves it. The Formaquestion mascot tab's import keeps working.

## Acceptance criteria

- [ ] A multi-location drag undoes in one press and the list view shows the earlier positions.
- [ ] A travel-hint typed run undoes in one press; a run of keyboard nudges within the pause undoes in one press.
- [ ] An edit made in the list panel between a canvas Step and its undo survives the undo.
- [ ] The showcase canvas's history isolation test still passes.
- [ ] The mascot tab's undo and redo still work.
- [ ] Canvas commits are proved at the provider seam; the existing Playwright canvas suite still passes.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.
