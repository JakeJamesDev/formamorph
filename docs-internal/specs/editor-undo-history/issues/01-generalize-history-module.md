# 01: Generalize the history module

Status: ready-for-human
Blocked by: none
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a pure module with a subtle restore algorithm and three merge rules with precedence; the rest of the effort builds on its shape.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

The Locations Canvas's history module becomes the editor's history module. Nothing an author sees changes in this ticket: the canvas keeps recording and undoing through it exactly as today. The module gains what the later tickets need, with tests at the module seam.

- A Step carries one or more slice edits. Each edit holds the slice's touched records as they were and as they became, and the slice's id order on both sides. Any of the twelve world slices can be carried. The overview slice is one object and is stored whole on both sides.
- Restore is order-aware. Undo rebuilds the slice in the Step's earlier id order, puts each touched record back as it was, drops the ones the Step added, and keeps every untouched record where it stands now. A reorder undoes to the old order. An undone delete returns the record to its old place. An edit to another record made in between survives.
- Merge precedence, highest first: an open group swallows every write until it ends; a keyed write merges into the previous Step when the key matches and that Step is younger than the pause; writes recorded in one tick fold into one Step. A folded Step carries the key of its first write. The pause is a parameter, default 1000 ms.
- `jumpTo` moves the cursor to any index, undoing or redoing the Steps between. The World opened head is fixed: not a Step, not counted, and a jump target that restores the loaded baseline.
- The Saved marker sits between Steps. Recording after it leaves it in place; undo past it is allowed.
- Labels are a pure function of a Step and its key: action, slice type name, record display name, and the field's label when the key names one field. A Copy placeholder edit keyed to the placeholder labels as the placeholder. Overview Steps label as "Edit World: Field". The field-label table lives beside the module.
- The cap stays 100 Steps. The chord helper the Formaquestion mascot tab imports keeps its name and behavior.

## Acceptance criteria

- [ ] The canvas's existing history tests pass unchanged, or with only import renames.
- [ ] A reorder of a slice undoes to the earlier order and redoes to the later one.
- [ ] An undone delete returns the record at its earlier index, not at the end.
- [ ] A record edited between a Step and its undo keeps the in-between edit after the undo.
- [ ] An overview Step restores the fields it changed and leaves the others.
- [ ] A group open across several writes records one Step; a keyed run within the pause records one Step; a keyed write after the pause starts a new Step; a group beats a key, a key beats a tick fold.
- [ ] `jumpTo` across several Steps lands on the same world as the equivalent presses, in both directions, and the head row restores the loaded baseline.
- [ ] Labels: "Add Stat Hunger", "Edit Stat Hunger: Description", "Remove Location Docks", "Edit World: Thumbnail", "Edit Placeholder Eyes" for a Copy inside an entity.
- [ ] Every guard bites: the order test fails when restore ignores order; the precedence test fails when a key wins over an open group.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments

Mutation evidence, 2026-10-08, at `fa936bda`:
- Restore made to ignore the Step's earlier order and append returning records at the end: 6 of 45 red in the module tests (the three order-aware cases, two precedence cases that compare order, the World opened restore).
- An open group made to fall through to the key and tick rules: 4 of 45 red (group across writes, group beats key, group past the Saved marker, nested group).
- Both restored; module file diff empty; 87/87 green across the three history test files afterwards.
