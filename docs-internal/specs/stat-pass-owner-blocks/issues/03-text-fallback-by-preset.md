# 03: Text Fallback By Preset And Style

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a contained decision change in the turn pass and one prompt edit, with existing turn-pass tests as the pattern.

Parent: [Stat Pass Owner Blocks spec](../spec.md)

## What to build

The text fallback reads the same player and world blocks, and it runs for every built-in preset.

- **The text prompt** takes the Persona chip with the same picks as the schema prompt, then Other Stats and Other Traits. Its reply stays stat-change lines over the player's and the world's stats. Entity owners are skipped with a diagnostic as today.
- **Selection.** The pass asks the settings layer whether the active preset is a built-in. When it is, the fallback pair is the built-in text prompt rendered through that preset's style. When a user preset is active, the stat prompt is sent as written on the fallback path too. The string compare against the raw default is removed.

Rulings: Q3, Q14, Q17.

## Acceptance criteria

- [ ] The text prompt's system prompt holds the Persona block, Other Stats and Other Traits, and no entity block.
- [ ] On the Simple and XML built-ins a schema refusal runs the text pair in that style.
- [ ] On a user preset a schema refusal sends the preset's stat prompt as written.
- [ ] No test or source compares the stat prompt against the raw default string.
