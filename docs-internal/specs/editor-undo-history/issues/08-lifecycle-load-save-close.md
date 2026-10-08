# 08: Lifecycle: load, save, close, in-game

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: clear rules at known boundaries; the risk is a stray Step at load or a stack that survives a close.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

The stack starts and ends where an author expects (Q4, Q13, Q14, stories 14, 15, 28, 29, 40).

Ticket 02 landed with the stack resetting on world id change only. Discard reloads the same id and records as a Step, and save's link stamps record as Steps. This ticket must land before any release that carries 02.

- The recorder arms after load sets the baseline, so load and its Links-follow pass record nothing.
- Save adds the Saved marker and clears nothing. Undo past the marker compares against the stamped baseline by content, so a restored record that matches by content reads clean and the dirty flag follows undo in both directions.
- The recorder disarms before discard, and the stack clears on close from both hosts: the editor's own close and the in-game host's close, including the unsaved-changes path.
- In the in-game host the chords, pill and popover work the same, and the host dialog never suppresses the chords.

## Acceptance criteria

- [ ] Loading a world records no Step; the first edit is the first Step.
- [ ] Save adds the marker; undo past it makes the world dirty; redo back to it reads clean.
- [ ] Close and reopen the same world: an empty stack. Same through the in-game host's close.
- [ ] Discard on exit leaves no Steps for the next open.
- [ ] In the in-game host, Ctrl+Z undoes and the pill works.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.
