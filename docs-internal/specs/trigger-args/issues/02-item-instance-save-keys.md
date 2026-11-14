# 02: Item Instance save keys

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: a small key rename, but a save migration on a shipped shape must be exact and idempotent.

## Parent

[spec.md](../spec.md) — Trigger Args and Item Instances (Q17).

## What to build

Every save key that names an Item Copy says instance: the snapshot's list of Item Instances, the copy id fields in saved inventory operations (Tool calls' saved writes), and any ledger key that holds one. A save migration renames them on load, after the version short-circuit beside the existing steps. A player's old save loads with every item where it was.

## Acceptance criteria

- [ ] Every save key that named an Item Copy is renamed; the list of keys is in the ticket's Landed section.
- [ ] A save in the old shape loads with every instance, its owner or location, quantity, equipped state, uses and State in place (test).
- [ ] A saved Tool call's inventory writes replay on a re-roll after migration (test).
- [ ] The migration is idempotent.
- [ ] Each guard is shown to bite by reinstating the bug.
- [ ] The response reminds the user of the save export-shape change.
