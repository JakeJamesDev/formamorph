# 04: Item event cause and parties

Status: ready-for-agent
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

- [ ] Each `by` value from its source: pass, panel give and drop, script write, nested script write, Becomes, forced unequip (tests through the item runs and the pass).
- [ ] `from` for a transfer from the persona (`=== persona`), from an entity, from a location, and `null` for a gain (tests).
- [ ] `to` for a transfer and `null` for a lose (tests).
- [ ] A script grant nested under a pass transfer reads `'script'`, `from` `null` (the spec's Q8 example).
- [ ] Docs and hover cards describe `by`, `from` and `to`; the help vectors are rebuilt.
- [ ] Each guard is shown to bite by reinstating the bug.
