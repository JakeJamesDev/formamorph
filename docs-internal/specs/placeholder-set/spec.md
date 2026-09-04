# Placeholder Set

Status: ready-for-agent

The read side of a placeholder list as one deep module. Raised by the 2026-09-01 architecture review
(candidate 1); decisions settled in the grilling that followed. Re-checked against 228d734: 44 describe/resolve sites, 7 migration sites. Terms: `CONTEXT.md` → Placeholders.

## Problem

Every surface that shows authored text re-decides two things by hand: which def list to read against, and
whether to describe (design time) or resolve (a playthrough). About forty call sites carry that judgment,
seven read boundaries carry the migration of carried defs, and the describe walk and the resolve walk are two
copies of one grammar in `src/lib/placeholders.ts`. Commit 32fb709 and the diff in flight each hand-carried
the same one-line fix across five surfaces.

## Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Interface shape | Two verbs on a bound value: `set.describe(text, pins?)` and `set.session(rolls).resolve(text, pins?)`. One walk inside. |
| 2 | Carrier | An object built once from a list, carrying the migrated defs and their lookup map. |
| 3 | Sequencing | The uncommitted placeholder work commits first. This lands on top. |
| 4 | Name | Placeholder Set (read side). Placeholder Store stays the write side. |
| 5 | Delivery to React | The Set replaces the array wherever the array is threaded. `GameDataContext` derives one memoized Set beside the array the Store writes. |
| 6 | Pins | Bound per resolve call, not in the Session. Rolls bind in the Session. |
| 7 | Methods | The read helpers of `placeholders.ts` (value summary, path level, path children, children, parts, reachable ids, preview, draw once) **and** the tree read-queries of `placeholderTree.ts` (rows, holderOf, owner path, row chance, cycle exclusions, owned descendants, shared weight site, used-by map) become methods. Mutators stay free functions. |
| 8 | Tests | `describePlaceholders` and `resolvePlaceholders` go module-private. `placeholders.test.ts` and `placeholderTree.test.ts` port their call forms to the Set. No assertion changes. |
| 9 | Store | `PlaceholderStore` exposes a derived Set. The library's isolated adapter derives its own. |
| 10 | Bench gap | Out of scope. Ticket `hierarchical-placeholders/issues/13` (reproduced, ready-for-agent). Behavior stays exactly as today. |
| 11 | Migration | The four sites that mint a typed Entity or Book keep their idempotent migration. The Set constructor migrates too. The three describe-only read boundaries fold away: 7 → 5. |

## Shape

- `src/lib/placeholderSet.ts`: `PlaceholderSet` interface, `placeholderSet(list)` factory. Always migrates;
  memoized by array identity (WeakMap).
- `src/lib/placeholders.ts` keeps the walk, un-exported. `src/lib/placeholderTree.ts` keeps mutators and
  the drop projection.
- `usePlaceholderSet()` from `GameDataContext`. Non-React sites (storage services, publish payload, file
  parsers) call the factory on raw record data.
- Describe keeps its depth cap; resolve keeps its. Same outputs as today.

## Done

- Four gates green.
- Every describe and resolve site reads through a Set; the two free functions are not exported.
- Tests ported; a throwaway parity script runs old and new over every text in the three bundled worlds with an
  empty diff, then is deleted.
- `CONTEXT.md` Placeholders family present (done in the grilling).
- Ticket 13 filed (done in the grilling).
