# 01: Keyed Owner Scene For The Stat Pass

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a scene substitution behind an existing lazy values source, proven by byte-equal bodies and rendering tests with prior art.

Parent: [Stat Pass Owner Blocks spec](../spec.md)

## What to build

The stat pass renders its chips from a scene whose owned stats carry the request's keys.

- Before any chip value renders for the stat pass, every present entity's owned stats are renamed to the keys the stat request assigned them, as the world and played stats already are. The scene the narration, choices and planning prompts read keeps raw names.
- The substitution happens at the lazy values source the Chip Options spec built, so every chip the stat prompt can hold reads the keyed scene: Persona, Entities in every scope, and the Stats chip.
- Nothing in the default prompt changes. The default request bodies stay byte-equal before and after.

Demo: a custom Stat Updates prompt that holds an In Scene Entities chip with Only With Stats shows `Health (2)` under an entity whose stat name clashes with the player's, while the narration prompt shows `Health`.

Rulings: Q7.

## Acceptance criteria

- [ ] An In Scene cast entry in the stat pass names a clashing entity stat by its request key; the same entry in narration keeps the raw name.
- [ ] A Persona chip in the stat pass names a clashing persona stat by its request key.
- [ ] Every Entities scope and the Stats chip read the keyed scene in the stat pass.
- [ ] The parity run over recorded history shows byte-equal request bodies for every pass.
