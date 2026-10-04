# 18: Mascot undo and redo

Status: ready-for-human
Blocked by: 17
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A wrong step on the Mascot tab is one Ctrl+Z away.

- Undo and redo over the draft: a history of draft snapshots, with Undo and Redo buttons in the footer beside Save and Cancel, and Ctrl+Z / Ctrl+Shift+Z while the tab has focus.
- A slider drag, a Mask drag or a typed run is one step, closed at pointer-up or blur. Layer and overlay reorders, adds and removes are one step each. Reset is one step (Q57).
- Save and Cancel clear the history. Nothing touches the image store; the draft already defers deletions to Save.

Spec: Q55; Implementation → Mascot draft.

Recommended model rationale: a history of one immutable value with step coalescing, on an existing draft.

## Acceptance criteria

- [ ] Pure tests: push, undo, redo, a branch after undo drops the redo stack, coalescing of a drag into one step.
- [ ] Component tests: a removed layer comes back on Undo with its overlays; Undo after Reset restores the whole custom rig; a slider drag undoes as one step; Save clears the stack; the shortcuts work only while the tab has focus.
- [ ] The four gates are green.
