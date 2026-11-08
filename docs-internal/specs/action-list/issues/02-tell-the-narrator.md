# 02: Tell the Narrator

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A prompt change with probes, plus the turn-input plumbing ticket 03 reuses.

## What to build

When the player sends, the shown entries ride along with the action to the narrator, and the story reacts to them. Hidden entries never reach the AI. The player can send with an empty action box when the list has shown entries. Sending closes the list. The sent page shows the list under the action line in a compact read-only form, with hidden entries marked as visible only to the player.

The block reaches the narration request only (Q8), in the thinking-off lane only (Q10). It is the preset's wrapper line followed by one code-written line per shown entry (Q19). The wrapper is a new preset field in Prompts → Narration → Messages beside Direction, with its own reset. History stores the bare action. This ticket owns the shape that carries the shown entries into the turn, which ticket 03 reuses for the Inventory pass.

Spec rulings: Q3, Q4, Q8, Q10, Q11, Q19, Q22.

## Acceptance criteria

- [ ] With shown entries and thinking off, the narration request ends with the wrapper and one line per shown entry. A narrationPrompt test covers it.
- [ ] Hidden entries never appear in any request.
- [ ] With native thinking on, the block is absent.
- [ ] No other pass (choices, stats, digest) gets the block.
- [ ] History keeps the bare action; the next turn's request does not repeat the block.
- [ ] The wrapper field shows in Prompts → Narration → Messages with a reset, and the anatomy marks the block as assembled context.
- [ ] Send is enabled with an empty action box when the list has a shown entry, and disabled when it has only hidden ones.
- [ ] Sending closes the list, and the sent page shows its entries, hidden ones marked player-only.
- [ ] Probe numbers (`probe` skill): the narrator reacts to shown entries and does not mention hidden ones, with in-batch controls, cloud and local.
- [ ] Frames: `.scratch/frames/sent-page.png`, light and dark, at 1440 px wide.

For you: whether the narration reads naturally after a potion-only turn in a real game.
