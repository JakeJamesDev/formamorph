# 03: Inventory Pass Guard

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A pass rule and a prompt line that must work together (the Item Use and Identity Q52 lesson), with probes.

## What to build

A player drinks a potion from the panel and the narrator describes it. The Inventory pass no longer consumes a second potion for it. The pass request gets a line naming the shown inventory entries as already done. In code, when the pass returns an operation of the same kind on the same item and target as a shown entry, one matching operation is dropped per shown repeat, with a diagnostic log line like other pass skips. A real second use beyond the shown count still lands. Hidden entries guard nothing, so a typed "I drink a potion" after a hidden correction works.

Spec rulings: Q7, Q9, Q21.

## Acceptance criteria

- [ ] The Inventory pass request carries the "already done" line for shown inventory entries only. It reuses ticket 02's turn-input shape. Superseded by Q50: no line. The guard reads 02's `toldActions`, and turnPasses' "reaches no other pass (Q8)" test still holds for the Inventory pass.
- [x] A pass `use` matching a shown entry is dropped and logged; a pass test covers it. `pass.guard.test.ts` "drops a use that reports a shown use, and logs it"; give, drop, pick up, equip, unequip and runtime items have their own cases.
- [x] A second `use` beyond the shown count still lands; a pass test covers it. "lands a second use beyond the shown count" (two ops, and one ×2 op landing its remainder, Q45).
- [x] A hidden entry drops nothing; a pass test covers it. "drops nothing for a hidden entry (Q21)", through the real `toldActions`.
- [x] Each guard test fails when its rule is removed. Mutations: no guard (6 red), no budget, hidden told, any owner, any receiver, any pick-up source, kind filter, owner on equip and unequip; each turned its test red.
- [x] Probe numbers (`probe` skill): the double consume rate with the prompt line and the rule, against controls, cloud and local. `inventory-told-probe.cli.ts`, table below; the line arm ran on cloud before Q50 dropped it.

## Landed

Probe, 12 runs per case; right = the expected rows, nothing else moved.

| case | cloud, rule off | cloud, rule on | Cydonia, rule off | Cydonia, rule on |
|---|---|---|---|---|
| potion-empty (panel drink, empty box) | 0/12 | 12/12 | 0/12 | 12/12 |
| potion-typed (panel drink, drink typed too) | 0/12 | 12/12 | 0/12 | 12/12 |
| give (panel give to Odette) | 0/12 | 12/12 | 0/12 | 12/12 |
| second (control: typed second drink, narration shows only it) | 12/12 | 0/12 | 12/12 | 0/12 |
| second-both (control: narration shows both drinks) | 12/12 | 8/12 | 12/12 | 12/12 |

Before Q50, the cloud line arm (three wordings) moved no double (0/12 in every case) and turned second-both to 0/12 with the rule.

**Not verified**
- The first criterion: superseded by Q50.

**For you**
- A typed second use of the same item in the same turn is dropped when the pass reports only the new one (the `second` row, 0/12 on both models). In play: drink a potion from the Inventory tab, then type "I drink my other potion" and send; check whether the second potion is gone.
- The pick up guard matches a gain from the floor or from no one, never a gain a character hands over. Q44 does not name the source; the spec session may want to rule it.
