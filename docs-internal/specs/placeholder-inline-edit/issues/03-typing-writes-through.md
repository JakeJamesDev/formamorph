# 03: Typing Writes Through to the Placeholder

Status: ready-for-human
Base: 5c4c62bf
Blocked by: 02
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Type: task
Spec: ../spec.md (Writing through; Undo)

Model rationale: two-way sync between editor state and a store, with focus and undo traps the prototype recorded.

## What to build

On the Values tab the author clicks into an open value and types. The placeholder's value text changes,
and every chip of that placeholder in every field shows the new text. The field's own text never changes.

- The write goes through the bound placeholder store, the same one the chips use to rename. No new
  provider. The update carries the same placeholder with one value's text changed; ids, weights, pins and
  ownership stay.
- The write follows the editor's update cadence, not each keystroke.
- The stored value text never starts or ends with whitespace. Edge whitespace stays in the slot only;
  ticket 05 decides where it goes on exit.
- A store change from elsewhere refills every slot that does not hold the caret. The slot that holds the
  caret refills when the caret leaves.
- Slot edits are part of the editor's history. Undo writes the previous text back to the store.
- A programmatic focus must target the slot's own editable island, not the editor root. Moving a slot
  container while it holds focus blurs it; restore focus when it lands on the body.
- A chip typed or inserted inside a value is stored as its token in the value text.

## Acceptance criteria

- [ ] Typing in a slot updates exactly one value's text in the placeholder store.
- [ ] The field's change callback never fires from a slot edit.
- [ ] A second field that uses the same placeholder shows the new text on its Values and Preview tabs.
- [ ] An edit made on the Placeholders tab refills an open value that does not hold the caret.
- [ ] Undo inside a slot restores the previous text in the editor and in the store.
- [ ] The stored value never starts or ends with whitespace.
- [ ] The open value stays open on the same value through its own edit (depends on 01's id keying).
- [ ] Component tests cover write-through, no field change, outside refill, and undo.
- [ ] Changelog In-Progress entry added. Four gates green.
