# 09: Inventory Pass

Status: ready-for-agent
Blocked by: 06, 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: xhigh

Opus at xhigh: a new AI pass with a schema, a text fallback, a new parser, presets, samplers and routing, plus two prompt changes that need probes.

## What to build

The story changes the inventory. A new post-narration **Inventory pass** is due when the world has authored items or the game has Item Copies (Q37). It joins the parallel batch under Concurrent Turn Requests. Its request lists the present owners' Item Copies and the location's Item Copies, hidden ones marked hidden (Q38), and asks for operations through a JSON schema: gain, lose, transfer, equip, unequip, consume and reveal (Q23).

On a schema refusal it uses the shared refusal handling and remembered per-endpoint text mode, with its own text prompt, text line format and parser (R2). It gets prompt-preset keys for its system and user prompts, a sampler entry that pins temperature and penalty, and per-prompt Native Reasoning and endpoint routing.

Parsed operations go to the Inventory module with the source `pass`. A name matches an authored item ignoring case and surrounding spaces, on resolved names; an unmatched name reuses an earlier runtime item of that name or creates one, Stackable and Consumable with no slot and no effects (Q24, Q36, Q56). Inventory changes commit before stat-pass deltas, and the stat pass prompt gains a line stating the turn's item effects are already applied (Q53).

Spec: R1, R2, Q18, Q22, Q23, Q24, Q36, Q37, Q38, Q53, Q55, Q56, Q62; stories 25, 54–68.

## Acceptance criteria

- [ ] A world with no items and no Item Copies never sends the pass
- [ ] With Concurrent Turn Requests on, the pass runs in the parallel batch
- [ ] Each of the seven operations applies through the module; an invalid one is skipped with a diagnostic
- [ ] A schema refusal falls back to the text prompt and parser, and the endpoint is remembered as text mode
- [ ] "iron sword" matches the authored Iron Sword; "rusty key" twice makes one runtime item; "iron swords" does not match
- [ ] An entity discovered this turn can receive a transfer
- [ ] Inventory changes commit before stat deltas
- [ ] Preset keys, sampler pins, Native Reasoning and endpoint routing exist for the pass and export with settings
- [ ] Probe numbers on the cloud default and Cydonia with in-batch controls: operation accuracy on a fixed scene set, and the stat pass no longer double-adds a drunk potion's effect
- [ ] The guide pages for the turn and for items describe the pass; changelog fragment written
- [ ] Discarding an unpaired user turn and the stats-only re-roll restore Item Copies the pass wrote (from ticket 02's landing)

For you: play a few turns that pick up, give and drink items and check the panel follows the story.

## Blocked by

- 06
- 07
