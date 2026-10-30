# 04: Pass Operations

Status: ready-for-human
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A prompt change: ships with probe numbers (`probe` skill).

## What to build

The Inventory pass gets the new operations. `consume` becomes `use`, sent for any use the story shows (drinking, reading, opening, blowing, spending a charge); the item's When Empty decides what remains. For a runtime item, `use` carries `after` (`kept` or `used up`). `change` sets a copy's State for a change that is not a use. `reveal` covers a hidden item coming into view and an item's true nature becoming known. The schema, the text line format, the parser and the prompt change to match. The re-gain probe gains the cases that prove it.

Spec: Implementation Decisions under The Inventory pass; Q4, Q6–Q10, Q23.

## Acceptance criteria

- [x] The schema and the text line format carry `use`, `change`, `state` and `after`; `consume` is gone — `pass.test.ts` schema and line tests; `consume` fails the schema and the parser drops it. `state` and `after` are optional in the schema: required, they made cloud loop on whitespace until max tokens (smoke run)
- [x] `use` on an authored item follows its When Empty; `after` is read only for runtime items — `pass.test.ts` "follows an authored item's When Empty whatever after says", "keeps a runtime item a use leaves kept"; mutation-tested
- [x] `change` from the pass sets the named copy's State — `pass.test.ts` change cases (split, quantity, same-State skip, runtime, location and hidden copies, no-state skip); mutation-tested
- [x] The prompt describes `use`, `change` and both jobs of `reveal` — `defaultInventoryPrompt`
- [x] The re-gain probe's fixture adds: unseal, open a box, light the lantern and soaked cloak (state); drink, blow a horn and read a single-use letter (use); a reveal-identify case; burn the letter and shatter a draught (guards); read-open stays as the control — `inventory-regain-cases.json`, read-open added as a new case (Q49)
- [x] Cloud, 12 runs per arm, in-batch controls: the state cases beat shipped by a margin whose CI excludes zero; take-another, second-eel and the use-up guards hold their shipped rate; the base cases don't drop. The numbers go in the landing — state 24/48 → 41/48, +35 pts, 95% CI [+17, +51]; guards hold or rise; base 92/108 → 99/108 (see Landed)
- [x] The changelog entry for the Inventory pass names the new operations — fragment `item-use-and-identity-04.md`, a new entry under Inventory

## Blocked by

- 02
- 03

## Landed

Probe: `inventory-regain-probe.cli.ts`, cloud `default`, 12 runs per arm, shipped vs new, 0 failed requests.

| Group | Shipped | New | New − shipped (95% CI) |
|---|---|---|---|
| State (Q49 hit: kept, nothing else moved) | 24/48 | 41/48 | +35 pts [+17, +51] |
| State set (new non-blank word) | 0/48 | 20/48 | |
| Use | 15/36 | 36/36 | +58 pts [+40, +73] |
| Reveal-identify | 2/12 | 12/12 | +83 pts [+46, +95] |
| Regain guards (take-another, second-eel) | 24/24 | 24/24 | 0 |
| Use-up guards (burn writ, shatter draught) | 11/24 | 24/24 | +54 pts [+31, +72] |
| Read-open control | 0/12 | 12/12 | +100 pts [+66, +100] |
| Retouch | 12/24 | 1/24 | −46 pts [−65, −21] |
| Replays (no re-gain) | 41/60 | 54/60 | |
| Base | 92/108 | 99/108 | |

- The prompt took four full runs. Cloud drifts between batches (shipped read-open went 9/12 → 0/12 between two batches), so only in-batch arms compare.
- Q50: the `use` line reads "as it is meant to be used", and `lose` names burned, broken or destroyed. Without them, both arms sent `use` to burn or shatter an item.
- The `change` line says the owner still holds that same item. Before that, the model split a fold-away into `change` plus a fresh `gain` (read-open 0/12). A variant A/B on the drifting cases picked it.
- Q51: a pass name copied with its Items Here marks, such as "Letter (opened)", reads as the name before " (", as a trailing colon summary already did. The fixture's runtime letter is now "Letter", so a sealed or opened State doesn't contradict its name.
- A `change` the reply sends with no `state` field is skipped; an explicit empty `state` clears it (Q31).
- What remains is the re-gain of a correctly named held item: retouch-shown 12/12 → 0/12 and light-lantern 12/12 → 7/12, each a `gain` to the owner who already holds the item. Follow-up below.

**Not verified**

- Nothing unticked.

**For you**

- Play a turn that opens a letter and one that lights a lantern, and check the Inventory tab keeps the item with its new State.
- Follow-up: the pass still re-gains an item its owner holds when the story only shows or lights it (retouch-shown, light-lantern). Decide whether that is a new ticket.
