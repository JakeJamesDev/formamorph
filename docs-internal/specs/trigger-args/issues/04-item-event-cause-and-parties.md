# 04: Item event cause and parties

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: the cause and both parties must be recorded where each write happens, across the operations, the pass, the panel, the script chain and the settle.

## Parent

[spec.md](../spec.md) — Trigger Args and Item Instances (Q5, Q7, Q8).

## What to build

Every item event carries `args.by`. It reads `'story'` from the Inventory pass, `'player'` from the Inventory panel, and `'script'` from a script's inventory write at any depth, World Tools included. It reads `'rule'` for a Becomes result and for an unequip forced by a full slot, a Body change or a requirement.

When Gained carries `args.from` and When Lost carries `args.to`. Each holds the entity entry or the location entry of the other side, or `null` for a new or destroyed instance. The persona resolves to `persona`, so `args.from === persona` means the player gave it. A pass pickup from the ground reads the location. The guide's Item Timings section and the hover cards describe the fields.

## Acceptance criteria

- [x] Each `by` value from its source: pass, panel give and drop, script write, nested script write, Becomes, forced unequip (tests through the item runs and the pass). — `statCodeTurn.itemCause.test.ts`: real scripts through `runItemScripts` on events from `applyInventoryPass`, `applyInventoryOps` (panel, script) and `settleInventory`; forced unequip by a full slot and by a requirement.
- [x] `from` for a transfer from the persona (`=== persona`), from an entity, from a location, and `null` for a gain (tests). — same file, pass and panel cases; a new stack and a single item both read `null`.
- [x] `to` for a transfer and `null` for a lose (tests). — panel give and drop, pass transfer, script lose.
- [x] A script grant nested under a pass transfer reads `'script'`, `from` `null` (the spec's Q8 example). — "reads a script grant nested under a pass transfer as script, from null (Q8)".
- [x] Docs and hover cards describe `by`, `from` and `to`; the help vectors are rebuilt. — Scripts-Reference Args, ScriptsGuide Item Timings, `ITEM_ARGS_ENTRIES` (tree and card tests), `build:help-vectors` re-embedded 2 sections. Test Code's sample carries `by`, `from`, `to`.
- [x] Each guard is shown to bite by reinstating the bug. — 16 mutations (each source cause, Becomes, swap-out, settle, both gain `from`, transfer `from`/`to`, lose `to`, `by` dropped from args, persona/entity/location/id resolution); each turned the new tests red.

## Landed

**Not verified**
- None unticked. A Body-change unequip has no test of its own; it shares the settle's `fireUnequipped` with the requirement case, which is tested and mutation-checked.
- A persona with no entity name key reads `persona` by the same branch as a keyed one; only the keyed case runs in a test.

**For you**
- An entity or location with no usable name key (no `entities`/`locations` entry) reads `from`/`to` as `null`, the same as new or destroyed. The sandbox has no entry to give.
- An unequip caused by losing or giving away an equipped item reads the writer's cause, not `'rule'` (the spec's rule list names only a full slot, a Body change and a requirement).
- Seen in passing, not changed: `scriptMoney.ts` applies a script's item-backed payments and drops their events, so a payment fires no item scripts.
