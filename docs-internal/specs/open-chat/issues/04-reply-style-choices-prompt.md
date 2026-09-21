# 04: Reply-Style Choices Prompt

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

Open Chat supplies its own choices prompt. Choices read as short replies or actions in the voice of the player: things the player could say or do next in the conversation. Start from the built-in choices prompt and keep its chips and its output contract, so the choices parser still works. Sampler pins stay as they are.

Read the prompt-writing guide before editing. Follow it: positive contract, generic examples only, no parrotable values.

## Acceptance criteria

- [ ] The override is present and enabled on the world, and the per-world opt-out still restores the preset of the player
- [ ] The choices parse with the existing parser on every probe run
- [ ] A/B probe against the built-in prompt on both reference tiers, at least 2 runs per case, one imported card as the fixture
- [ ] Metrics with before and after numbers are recorded under Comments: choices in the voice of the player, choice length, parse success
- [ ] The regression check from the guide passes on the other metrics
- [ ] The content test asserts the choices override is present
- [ ] Four gates green
