# 04: Field Pulse on Text Fields

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: this ticket designs the stable field identity in the DOM that 05 and 06 build on. The find bar's text matching can't be reused, because reveal runs after the text changed.

Parent: [History Reveal Origin spec](../spec.md)

## What to build

Text fields and Lexical prompt fields carry a stable field identity. The Origin records the field in use at the write. After the tab, selection and sub-view are restored, reveal scrolls to the field and plays the Landing Pulse on it (Q7). Keyboard focus stays where it was. If the field isn't rendered, reveal stops at the selection with no pulse (Q8). The pulse plays on every undo and redo, even when the author is already on the field, and restarts on key repeat (Q9). Reduced motion gets the still ring.

## Acceptance criteria

- [ ] A text field edit pulses that field after undo and redo.
- [ ] A Lexical prompt field edit pulses that field.
- [ ] A field inside an array row pulses that row's field, not the first row's.
- [ ] After reveal, focus is on the element that held it before the undo. The focus test fails when reveal focuses the field.
- [ ] A missing field ends the reveal at the selection with no pulse.
- [ ] Two quick undos restart the pulse.
- [ ] Reduced motion draws the still ring.
- [ ] Bench tests for each case.
