# 05: Lexical fields and plain inputs

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the one place two stacks touch; Lexical's update tags and the value sync's rebuild rules must agree in both directions, and the tests drive the composer directly.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

Ctrl+Z inside a prompt field undoes the field's own text first, and hands the press to the world when the field has nothing left (Q1). Inside a world-bound plain input the world stack owns the chord (Q10). A field's own undo never shows as a Step, and a world undo into a focused field never becomes a text-undo entry (stories 16 to 19a).

- A Lexical field reports whether it can undo and redo. The shared listener yields to it when it can, in the asked direction.
- The field's value sync marks the writes Lexical's own history makes by reading the historic tag on the update, and passes the mark with the change. The recorder treats a marked write as a cursor move on the Step it matches by key and content, and as a plain write otherwise.
- A world undo or redo that restores a field's value rebuilds the field with the history-merge tag, so the restore never pushes a Lexical entry.
- The listener yields while the event is composing (IME).
- A world-bound plain input gets its default prevented so native undo never runs. Inputs not bound to the world (filter boxes, Search World, the find bar) keep native undo and the listener yields on them. Ticket 02 left an interim yield to every focused input, textarea, select and contenteditable; this ticket replaces it.
- Q25: the image replace prompt, the code rename offer and the Replace All confirm report surface ids, and the listener also yields to any open modal above the editor as a backstop.

## Acceptance criteria

- [ ] Type in a prompt field, press Ctrl+Z: the field undoes. Keep pressing: when the field is empty of history the world undoes the previous Step.
- [ ] After the field's own undo, the History list holds no new Step.
- [ ] World-undo into a focused field, then Ctrl+Z: the next world Step undoes, not the restore.
- [ ] Ctrl+Z in a stat name input undoes the typed run through the world and the browser's native undo does not run.
- [ ] Ctrl+Z in the Stats filter box leaves the world alone.
- [ ] A composing keydown does nothing.
- [ ] Ctrl+Z under the image replace prompt, the code rename offer and the Replace All confirm leaves the world alone.
- [ ] Bench tests drive Lexical through the composer's undo command and update calls, not through simulated typing.
- [ ] Guard bites: the no-Step test fails when the historic tag is ignored.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.
