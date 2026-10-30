# 04: Pass Operations

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A prompt change: ships with probe numbers (`probe` skill).

## What to build

The Inventory pass gets the new operations. `consume` becomes `use`, sent for any use the story shows (drinking, reading, opening, blowing, spending a charge); the item's When Empty decides what remains. For a runtime item, `use` carries `after` (`kept` or `used up`). `change` sets a copy's State for a change that is not a use. `reveal` covers a hidden item coming into view and an item's true nature becoming known. The schema, the text line format, the parser and the prompt change to match. The re-gain probe gains the cases that prove it.

Spec: Implementation Decisions under The Inventory pass; Q4, Q6–Q10, Q23.

## Acceptance criteria

- [ ] The schema and the text line format carry `use`, `change`, `state` and `after`; `consume` is gone
- [ ] `use` on an authored item follows its When Empty; `after` is read only for runtime items
- [ ] `change` from the pass sets the named copy's State
- [ ] The prompt describes `use`, `change` and both jobs of `reveal`
- [ ] The re-gain probe's fixture adds: unseal, open a box, light the lantern and soaked cloak (state); drink, blow a horn and read a single-use letter (use); a reveal-identify case; burn the letter and shatter a draught (guards); read-open stays as the control
- [ ] Cloud, 12 runs per arm, in-batch controls: the state cases beat shipped by a margin whose CI excludes zero; take-another, second-eel and the use-up guards hold their shipped rate; the base cases don't drop. The numbers go in the landing
- [ ] The changelog entry for the Inventory pass names the new operations

For you: play a turn that opens a letter and one that lights a lantern, and check the Inventory tab keeps the item with its new State.

## Blocked by

- 02
- 03
