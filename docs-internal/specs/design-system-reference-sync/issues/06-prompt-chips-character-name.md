# 06: Prompt Chips reference shows Character Name with its owner-name Preview

Status: ready-for-human
Base: 66d76f24
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

## What to build

The Prompt Chips reference adds a field owned by a sample entity with a non-blank name. The palette lists Player Name and Character Name under Built-in, each with its mark. Preview shows Character Name as that entity's name.

The guide's Built-in Placeholder chips section records the rule: Character Name previews as the owner's name; a blank name or a field with no owner keeps the label; Player Name keeps its label.

Recommended model rationale: a fixture, a palette entry, and a guide paragraph against a shipped chip system.

## Acceptance criteria

- [x] The palette lists Player Name and Character Name under Built-in, asserted by test
- [x] Preview shows the sample owner's name for Character Name, asserted by test
- [x] The guide states the owner-name rule and both fallbacks; new copy has a Writing review entry
- [x] The showcase registry test passes
- [x] Four gates green; verified in the showcase at desktop and 375px, both themes
