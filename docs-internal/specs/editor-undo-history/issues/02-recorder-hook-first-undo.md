# 02: Recorder, hook, and the first undo

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the recorder sits inside the world provider's commit cycle and every later ticket reads through its hook; a wrong seam here costs every ticket after it.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

The first end-to-end undo. An author removes a stat in the Stats tab, presses Ctrl+Z, and the stat is back where it was. Ctrl+Y removes it again. The desktop app bar shows the Undo and Redo faces of the split pill (Q15, variant B), disabled at the empty boundaries, each with a tooltip that names the chord. The chevron face lands in ticket 07.

- The recorder runs after commit: a layout effect in the world provider diffs the twelve committed slices against the last snapshot it recorded, by reference, and records what changed through the module from 01. It sees every write, including those that bypass the actions object. Writes in one tick fold into one Step.
- A side channel set before a setter runs carries intent to the recorder: a merge key, a group or batch label, or a flag. This ticket adds the channel and the flag for undo and redo writes; keys, groups and the other flags land in 04.
- Undo and redo write back through the provider's setters, flagged so the recorder never records them.
- The provider exposes one hook: can undo, can redo, the Steps with the cursor and markers, and undo, redo, jump. The pill and the tests read it there.
- One capture-phase listener in the editor reads the chord (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Cmd on a Mac). It yields when a surface opened after the editor is on the surface registry (Q18), while the tour runs (Q21), and when the event is composing. The Lexical and plain-input yields land in 05.
- The stack is held for the open world and cleared when another world opens. Close-time clearing and load arming land in 08; this ticket may clear on world change only.

## Acceptance criteria

- [ ] Remove a stat, Ctrl+Z restores it at its index, Ctrl+Y removes it again. Same for an add and an edit of a location and an entity.
- [ ] Two setter calls in one event handler record one Step.
- [ ] The Links-follow pass after a trait removal does not record a second Step (it folds, or ticket 04 proves the fold; this ticket must not leave it as two Steps).
- [ ] An undo write never appears as a new Step.
- [ ] The desktop pill shows Undo and Redo faces at the head of the end slot, disabled at the boundaries, with "Undo (Ctrl+Z)" and "Redo (Ctrl+Y)" tips.
- [ ] Chords do nothing while a dialog opened from the editor is on the registry, and while the tour runs.
- [ ] Opening another world starts an empty stack.
- [ ] Provider tests write through actions and read the world back; bench tests press the chords from the Stats list. No test reads the stack's arrays.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.
