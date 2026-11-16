# 02: Item Instance save keys

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: a small key rename, but a save migration on a shipped shape must be exact and idempotent.

## Parent

[spec.md](../spec.md) — Trigger Args and Item Instances (Q17).

## What to build

Every save key that names an Item Copy says instance: the snapshot's list of Item Instances, the copy id fields in saved inventory operations (Tool calls' saved writes), and any ledger key that holds one. A save migration renames them on load, after the version short-circuit beside the existing steps. A player's old save loads with every item where it was.

## Acceptance criteria

- [x] Every save key that named an Item Copy is renamed; the list of keys is in the ticket's Landed section.
- [x] A save in the old shape loads with every instance, its owner or location, quantity, equipped state, uses and State in place (`itemInstanceKeys.test.ts` "loads an old save…"; `GameplayContext.itemInstances.test.tsx` "load from a save written under the old itemCopies key").
- [x] A saved Tool call's inventory writes replay on a re-roll after migration (`itemInstanceKeys.test.ts` "replays a saved Tool call's inventory writes…", through `applyInventoryOps`).
- [x] The migration is idempotent (`itemInstanceKeys.test.ts` "is idempotent…").
- [x] Each guard is shown to bite by reinstating the bug (eight mutations in `itemInstanceKeys.ts` and `version.ts`, each failed the matching test; one more on the snapshot step failed the load test).
- [x] The response reminds the user of the save export-shape change.

## Landed

Keys renamed, in code and in saves:

| Old key | New key | Where a save holds it |
|---|---|---|
| `itemCopies` | `itemInstances` | every snapshot: `currentState`, `stateHistory`, and the states inside `actionList` and `sentActions` |
| `copyId` | `instanceId` | saved Tool call writes (`messageHistory[].toolCalls[].writes.inventory`), and the facts of `actionList` and `sentActions` entries |
| `targetCopyId` | `targetInstanceId` | a saved `use` write |

The item script event fields (`ItemScriptEvent`, `SandboxItemEvent`) follow the same names. `migrateSave` renames the keys in `src/lib/itemInstanceKeys.ts`; a record holding both keys keeps the new one.

**Not verified**
- A re-roll through the full turn pipeline: the test replays the migrated writes through `applyInventoryOps`, not through the game.
- The nested legacy save path (`convertSaveFile`) is not migrated: those saves predate Item Instances.

**For you**
- Load a save written before this change and open the Inventory tab: every item should be where it was.
