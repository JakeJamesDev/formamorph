# 01: Code Bounds Become Ledgers

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Touches the derive step, the executor's write contract, the per-turn run, and a shipped save field with a migration. Opus at high effort.

## What to build

Q14. A bound write behaves like a value write. When code writes `self.max = 20`, the stat's effective max is 20 when the run lands, and every later change moves from 20: a trait switched on adds its change, a trait switched off removes it, an AI max change adds, a later code write sets a new number. Nothing code writes hides the layers under it.

The stored code bounds override and its replace-the-sum derive step go. Each stat carries a code delta per bound field beside the AI's max delta, and the derive step adds it on top: base, plus trait changes, plus the AI delta, plus the code delta. A bound write books the written number minus the bound as re-derived after this run's trait switches. Min and regen get their own ledgers.

`null` written to any writable field is a bad write and fails the run. The v5 empty-boxes clear goes: deleting code leaves the ledger where it is.

Code bounds shipped in v3.2.1, so a save can carry the old stored field. On load, each stored bound becomes a ledger entry equal to the bound minus the bound derived without it under the save's traits in force, per owner, and the old field is dropped. Idempotent, applied where the save-side stat refresh runs. This is a save shape change; the user sets the version.

The guide's bounds section is rewritten to the new rule. The lines about a code bound replacing traits go.

## Acceptance criteria

- [ ] `self.max = 20` derives to 20 after the run, whatever the stat's own trait switch moved this run
- [ ] A trait switched on the next turn adds its change to 20; switched off, removes it
- [ ] An AI max change on a later turn adds to the code-set number
- [ ] Min and regen writes behave the same way with their own ledgers
- [ ] `null` to `value`, `min`, `max`, or `regen` fails the run as a bad write, on `self` and on the editor's Test Code
- [ ] A stat with two empty boxes keeps its ledger; no clear runs
- [ ] A save with the old stored code bounds loads to the same effective min, max, and regen it showed, with the ledger holding the difference and the old field gone; loading twice changes nothing
- [ ] The per-turn, executor, and migration seams each prove the guard by reinstating the old behavior once
- [ ] The guide's bounds section states the ledger rule and no longer says a code bound replaces traits
- [ ] Changelog fragment written; four gates green

## Blocked by

- None (can start immediately)
