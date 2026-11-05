# 07: WorldEditor Pilot Batch

Status: ready-for-human
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: It sets the pattern and any shared test helpers that three later batches follow.

Parent: [Test Sweep spec](../spec.md)

## What to build

One group of `WorldEditor` panel tests moves off the full view mount (Q7). Pick the group from the ledger with the most time saved per file outside Q5 areas. Panel behavior moves to component tests or merges into them, and the view keeps its wiring tests. The ticket writes a short pattern note covering what stays a view test, and it owns any shared test helper later batches need.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q7, Q17, Q22, Q23.

## Acceptance criteria

- [x] The moved tests' time before and after is recorded in the ticket. See Results.
- [x] The kept-protection check shows no lost coverage on the modules under test. 15 pairs on the final layout, each exit 0 with 0 lost lines and branches.
- [x] One reinstated bug in the moved behavior turns a moved test red. `disabled={multiUse}` set to `false` in `ItemManager.tsx` turned "turns Stackable off and locks it at Uses 2 or more" red. Under Q50, dropping `currencies` from the export in `GameDataContext.tsx:98` turned "keeps Currencies and an item's Currency through an export and an import" red. Both sources are restored.
- [x] The pattern note lands in the spec folder, and the batches for tickets 8 and 9 are listed in it. [view-move-pattern.md](../view-move-pattern.md).

## Results

**Group:** the Items tab, the most time saved per file outside Q5 (23.8 s of ledger body time per file). It held `WorldEditor.itemsListEditor`, `WorldEditor.equipment` and `WorldEditor.itemIcon`.

| 88 tests, 3 alternating runs of each layout, medians | Before | After |
|---|---:|---:|
| Test bodies | 25.02 s | 9.37 s |
| Worker import time | 6.59 s | 6.86 s |
| Wall time | 14.8 s | 6.1 s |
| Files | 3 | 5 |
| Tests on the view mount | 88 | 6 |

| File | Tests | Body s | Import s |
|---|---:|---:|---:|
| `src/views/WorldEditor.itemsTab.test.tsx` | 6 | 1.77 | 2.12 |
| `src/managers/useWorldItemsAdapter.test.tsx` | 39 | 3.45 | 1.47 |
| `src/managers/BodiesSection.test.tsx` | 30 | 2.60 | 1.00 |
| `src/managers/ItemIconField.test.tsx` | 9 | 1.32 | 1.46 |
| `src/managers/SlotsSection.test.tsx` | 4 | 0.22 | 0.82 |

The ledger's 71.4 s for the old files is full-suite load, so it does not compare with these.

**Kept protection:** no test was deleted, and no `expect` line or test name changed (324 old, 324 new). The pairs were `WorldEditor`, `useWorldItemsAdapter`, `ItemManager`, `EquipmentEditor`, `SlotsSection`, `BodiesSection`, `BodyLayoutEditor`, `PlacementsSection`, `CurrenciesEditor`, `ItemRows`, `ItemValueFields`, `ItemIconField`, `ItemSlotRuleField`, and under Q50 `version.ts` and `GameDataContext.tsx`.

The moved export-and-import test calls Q5 code from a non-Q5 module. The spec session ruled that it takes no mutation run (Q50).

The 9 real-bug tests in the old `equipment` file stayed with their assertions, so Q9 does not apply.

## Landed

**Not verified:** nothing.

**For you:** nothing; no product code changed.
