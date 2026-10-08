# 04: Steps that match intent

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: many write paths across managers, each needing the right key or flag; the fold and flag rules interact and a miss shows up as a noisy history.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

Nothing an author would call one action takes two presses to undo (Q9, Q11, Q19).

- Merge keys from the write: a per-record update names the record and its one changed field. The function-taking entity edit and a partial overview update derive the field from the keys that changed; one key means a field key, more means none. Every manager's field write carries its key.
- A typed run into any world-bound field merges into one Step until a 1000 ms pause.
- Sliders, color pickers and other continuous controls open a group on press and close it on release, so a drag is one Step from the value before the press. Keyboard nudges and stepper clicks follow the pause rule.
- The Links-follow pass folds into the Step of the write that caused it.
- Save's link stamps are flagged and never recorded.
- An async operation that must be one Step calls the explicit batch with its label. Optimize Images runs as a batch labeled "Optimize Images", opened after its dialog closes.

## Acceptance criteria

- [ ] Typing a sentence into a stat description records one Step; typing again after the pause records a second.
- [ ] A slider drag that pauses while held records one Step whose undo returns the value before the press.
- [ ] Three stepper clicks within the pause record one Step.
- [ ] Removing a trait that drops Links records one Step; undo restores the trait and the Links together.
- [ ] Saving records no Step from its stamps.
- [ ] Optimize Images across the overview, entities and locations records one Step labeled "Optimize Images".
- [ ] A Copy placeholder edit inside an entity labels as the placeholder.
- [ ] Guards bite: the drag test fails when the group is removed; the Links test fails when the fold is removed.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.
