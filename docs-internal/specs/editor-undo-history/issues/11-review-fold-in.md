# 11: Review fold-in

Status: done
Blocked by: 10
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: two correctness defects in the merge rules, an unmount leak, and a sweep of smells across the managers and the context; each fix is small but the rules interact.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

Fold in the two-axis code review of the whole effort (`77f04069..bc3f80de`). Nothing new for the author; every edit the review names, in one unit.

### Defects

- **Q26 and Q33: a multi-field write keeps the record key.** A stat rename that also rewrites descriptors is keyed to the name field today, so a field undo of the name moves the cursor back while the renamed descriptors stay in the world. The write's key must drop the field when more than one field of the record changed, the field-move check must compare the whole Step against the field's write, and the intent test that asserts the field key for a rename must assert the record key.
- **Q23: a field-driven cursor move seals the top Step**, as undo, redo and jump do. Today it clears the flag, so a keyed write within the pause can merge across the Saved marker and null it.
- **Stories 37 and 41: the Design System showcase canvas gets its chords back.** The canvas's own reader was removed and only the editor listens; the showcase wraps its own recorder but no listener.
- **Unmount: an explicit batch never resolves if the provider unmounts before commit.** Optimize Images awaits forever and its finally never runs. Reject or resolve the waiters on unmount. The gesture leaf's window listeners added on pointer-down are removed on unmount, not only on the next pointer-up.

### Copy and docs

- Replace All's "Discard Changes is the only way back" line states what is true now: the change is a Step and History takes it back.
- The Redo tip names both chords, Ctrl+Y and Ctrl+Shift+Z (story 22).
- The wiki's Text Fields line: record names are Lexical fields (Q31); only world name and author are plain.
- The Design System row that links the deleted canvas history file points at the history module and the recorder.
- The spec's recorder section says what the code does: the stack clears through the editor's unmount effect on both hosts, and disarm runs at load. Q14's "discard from the in-game host" is dropped.
- Comments say "Locations Canvas" for the authoring surface, never "map"; the reveal module's "Locations canvas" too.
- Every `as unknown as` cast in the history test fixtures carries its one-line comment, or the fixture builds a typed record instead.

### Smells

- One wrapped input carries the `data-world-field` invariant, so the attribute is not hand-added at about 20 sites across 14 managers. Same for the textarea.
- The nine key-then-set pairs in the world context collapse into one keyed-setter factory; the entity edit runs its edit function once.
- The chord listener's modal detection reads the surface registry (and the `data-world-window` layer), not Radix's inline pointer-events style.
- The canvas nudge key carries the selected ids as a typed key part, not one joined string.
- The field's own stacks are cleared through Lexical's API or by replacing the history state, not by mutating the stack arrays.
- The dictionary write aliases get names that say why they differ from the update actions, or go.

## Acceptance criteria

- [ ] Rename a stat in its Lexical name field, press Ctrl+Z in the field: name and descriptors return together; the list holds no extra Step. The guard bites when the key keeps the field.
- [ ] Step, save, type, field-undo, then a keyed write within the pause: the Saved marker stays where it was. The guard bites when the move does not seal.
- [ ] Ctrl+Z in the Design System showcase canvas undoes a drag there and never touches an open world.
- [ ] Unmount the provider during an open batch: the await settles and the finally runs. A test proves it.
- [ ] The Replace All line, the Redo tip, the wiki Text Fields line and the Design System link read as above; `copy-sweep` run over the changed strings.
- [ ] No manager carries `data-world-field` by hand; the Q10 bench test still passes and fails when the wrapper drops the attribute.
- [ ] The world context has one keyed-setter factory; the intent tests pass unchanged except the rename assertion.
- [ ] The chord listener has no inline-style read; the full-screen canvas chord test and the modal tests pass.
- [ ] Test fixtures carry no uncommented `as unknown as`.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.
