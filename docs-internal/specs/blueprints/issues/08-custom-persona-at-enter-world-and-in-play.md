# 08: Custom Persona at Enter World and in play

Status: ready-for-human
Base: dcfa6752
Blocked by: 05 — Automatic copies and rewrites; 06 — Pins by blueprint
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high
Rationale: the save shape, bearer resolution for three persona cases, and two player surfaces meet here. The riskiest ticket for silent state drift.

Parent: [Blueprints spec](../spec.md)

## What to build

At Enter World the Custom Persona entity stands in None's place. Under create-your-own the player's entered name replaces the entity's name and the player's description follows the author's; both reach the AI. The marked entity's tree is the player's tree under create-your-own and under a library persona, beside the root traits. A world persona keeps its own tree. The picked persona renders at the marked entity's tree position and leaves its own group while played. A library persona's own copies win over the Custom Persona's; the Custom Persona's fill in where the library persona has none.

A world without a marked entity keeps None as today. The save keys the Custom Persona bearer by the marked entity, replacing the player's world key the system node used.

## Acceptance criteria

- [ ] Bearer-resolution tests cover the marked entity under create-your-own and under a library persona, a world persona beside it, and the marked entity out of the cast.
- [ ] Enter World and the Traits tab show the picked persona in the marked entity's slot, once.
- [ ] Copy lookup in play prefers the library persona's copy, then the Custom Persona's, then the blueprint.
- [ ] Save round-trip tests cover the new bearer key; a save from the system-node era does not load (no compat).
- [ ] The response names the export-shape change: the save's Custom Persona bearer key.
