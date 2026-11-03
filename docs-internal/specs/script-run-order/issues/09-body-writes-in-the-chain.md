# 09: Body Writes in the Chain

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Follows the Body equip fix in Q57. Ruling: Q60.

## What to build

The AI's Inventory pass checks an equip against the Body in force after a script's Body write, so an AI equip and a script equip agree. When one chain holds a Body write and an inventory write, the Body's log line names what the chain unequipped.

## Acceptance criteria

- [x] A test through the mounted game view proves the Inventory pass fits an equip to a Body that a script wrote this turn, and refuses a slot that Body lacks. `GameViewer.bodyWrites.test.tsx`, "the Inventory pass after a script's Body write", with both re-rolls.
- [x] A test proves the Body's log line names the unequips when one chain holds both write kinds, with no unequip fired twice. Same file, "an equip right after a Body write": `bodyLines` beside `ranOnce`, on switch, item, Before the AI and During AI Output chains.
- [x] Each new guard fails when its gap returns. Seven mutations reinstated one at a time; each turned the expected tests red.

## Landed

**Not verified:** none.

**For you:** nothing here needs a player's judgement.

Known limits, left as ruled:

- A trait Body that a script turns on mid-turn reaches the equip checks only at a settle (Q65).
- The replays skip During AI Output, so its Body write reaches neither replay's Inventory pass (Q52).
- A chain that writes a new Body, loses a piece, then writes the old Body back logs no Body line, so nothing names that piece.
