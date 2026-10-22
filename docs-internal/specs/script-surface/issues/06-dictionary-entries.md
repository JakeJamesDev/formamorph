# 06: Dictionary Entries

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one new map on an existing entry, following the pattern the entity maps already use.

## What to build

Each `dictionaries` entry gains `entries`, a map of the book's entries by entry name, each with `id`, `name`, `keys` and `value` (Q27). A book the player turned off is not listed, as today. The Sandbox Snapshot carries the entries for play and the editor; hover cards and the Variable menu show the map and its fields.

Spec: Q27, story 13.

## Acceptance criteria

- [x] `dictionaries.Lore.entries["Iron Crown"].keys` reads the entry's keywords and `value` its text; a muted book is absent — `statCodeTurn.dictionaryEntries.test.ts` (reads, muted and disabled absence, later name wins, code names, blank unknown, dropped writes)
- [x] Hover cards resolve `dictionaries.Lore.entries` and an entry's four fields; the Variable menu lists them under the book — `codeCards.worldItems.test.ts` (entries, four fields, entry card, completions); `statCodeVariableTree.test.ts` (Entries list; every leaf runs in the sandbox)
- [x] An entry name with a space reads through brackets, as the other maps do — "Iron Crown" and "Marsh Hen" cases in the tests above
- [x] Four gates green — prepare's gate run; landing requires it

## Blocked by

- None (can start immediately)

## Landed

The entries reach a run only when its code text names `dictionaries` (Q37). This gate is temporary: ticket 12 (Lazy Heavy Text In The Sandbox) removes it. Until then a computed global name reads empty entries; a test pins that limit.

Cost measured before the gate, `executeStatCode('return 1;')` with 1 KB entries, mean of 5 runs: 0 entries 3 ms, 500 → 16 ms, 3,000 → 74 ms, 10,000 → 253 ms per run.

**Not verified**

- None.

**For you**

- Hover an entry name and its fields in a script box on a world with a dictionary (World Editor › any Script). The card shows **Trigger Keywords**, and the Variable menu lists **Dictionaries › Book › Entries**.
