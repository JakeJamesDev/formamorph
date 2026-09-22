# 12: Probe the Three Styles

Status: in-progress
Base: 519c4c5a
Blocked by: 11
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

The three Styles read clearly different from each other, on both reference tiers. Probe the narration override with each Style's voice block in context, tune the voice blocks and the fixed prompt text on the numbers, and write the final values into the world file.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [ ] Three arms per tier, one per Style, at least 2 runs per case, one imported card as the fixture; cases: greeting as page one, cold open from the world opening, question, banter, task, and the no-entity guard
- [ ] Per-reply metrics under Comments: quotation marks present, grammatical person of the entity, the player's line restated or not, first-person message held (Chat), second-person narration held (Literary), words
- [ ] Each Style differs from the other two on at least one metric with a bootstrap interval that leaves out zero, on both tiers
- [ ] Chat holds its frame better than the revision 2 baseline on both tiers, or the ticket says why not
- [ ] Reply Length moves words in the same direction under every Style on the cloud tier
- [ ] An imported greeting as page one, followed by one turn under each Style, checked live in the Chat layout
- [ ] Four gates green
