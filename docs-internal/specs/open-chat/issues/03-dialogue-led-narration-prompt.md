# 03: Dialogue-Led Narration Prompt

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

Open Chat supplies its own narration prompt. The narrator stays in second person, but each reply centers the speech and actions of the entity. The entity is written in third person and addresses the player as "you", the same frame as an imported SillyTavern greeting.

Start from the built-in narration prompt and keep every chip: memory, persona, dictionary, language, and the rest. Change only the voice rules. The prompt reads the four tone chips from ticket 02. Several picked entities must still work, with no turn-taking rules. Sampler pins stay as they are.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [ ] The override is present and enabled on the world, and the per-world opt-out still restores the preset of the player
- [ ] Every chip in the built-in narration prompt is present in the override
- [ ] A/B probe against the built-in prompt on both reference tiers, at least 2 runs per case, one imported card as the fixture
- [ ] Metrics with before and after numbers are recorded under Comments: dialogue share of the reply, second-person frame held, reply length per Reply Length setting
- [ ] The regression check from the guide passes on the other metrics
- [ ] An imported greeting as page one, followed by one turn, keeps one frame, checked live
- [ ] The content test asserts the narration override is present and reads all four tone chips
- [ ] Four gates green
