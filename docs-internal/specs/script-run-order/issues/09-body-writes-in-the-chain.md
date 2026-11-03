# 09: Body Writes in the Chain

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Follows the Body equip fix in Q57. Ruling: Q60.

## What to build

The AI's Inventory pass checks an equip against the Body in force after a script's Body write, so an AI equip and a script equip agree. When one chain holds a Body write and an inventory write, the Body's log line names what the chain unequipped.

## Acceptance criteria

- [ ] A test through the mounted game view proves the Inventory pass fits an equip to a Body that a script wrote this turn, and refuses a slot that Body lacks.
- [ ] A test proves the Body's log line names the unequips when one chain holds both write kinds, with no unequip fired twice.
- [ ] Each new guard fails when its gap returns.
