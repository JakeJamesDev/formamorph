# 03: Inventory Pass Guard

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A pass rule and a prompt line that must work together (the Item Use and Identity Q52 lesson), with probes.

## What to build

A player drinks a potion from the panel and the narrator describes it. The Inventory pass no longer consumes a second potion for it. The pass request gets a line naming the shown inventory entries as already done. In code, when the pass returns an operation of the same kind on the same item and target as a shown entry, one matching operation is dropped per shown repeat, with a diagnostic log line like other pass skips. A real second use beyond the shown count still lands. Hidden entries guard nothing, so a typed "I drink a potion" after a hidden correction works.

Spec rulings: Q7, Q9, Q21.

## Acceptance criteria

- [ ] The Inventory pass request carries the "already done" line for shown inventory entries only. It reuses ticket 02's turn-input shape.
- [ ] A pass `use` matching a shown entry is dropped and logged; a pass test covers it.
- [ ] A second `use` beyond the shown count still lands; a pass test covers it.
- [ ] A hidden entry drops nothing; a pass test covers it.
- [ ] Each guard test fails when its rule is removed.
- [ ] Probe numbers (`probe` skill): the double consume rate with the prompt line and the rule, against controls, cloud and local.
