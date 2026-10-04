# 09: Prompts Edit | Preview and Pick/Lookup options

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Every help prompt gets the Edit | Preview tabs, and every request gets its own options.

- Each prompt field renders with Edit and Preview, the help chips resolved from the current settings. No Values tab.
- A help preset holds one options block per prompt: Answer, Pick and Lookup each with temperature, repetition penalty and Max Output. The Default preset's Pick and Lookup blocks follow the code and equal today's pinned values. Each prompt row gets an Options sub-row with the shared per-prompt controls.
- The help session reads each request's options from its own block. Each block's per-field Custom checkboxes restore the Default's values; Compare to Default stays a text diff (Q34).
- The preset file carries the three blocks. Its version stays 1 and the shape changes in place; a v1 file of the old shape fails naming the missing block (Q33). Export-shape change: say so in the response.

Spec: Q5, Q33, Q34; Implementation → Help presets and the preset file, Prompts tab.

Recommended model rationale: a preset shape change with a file version bump, session plumbing and tab rows in one slice.

## Acceptance criteria

- [ ] Session tests: the pick and lookup requests carry their blocks; the Default preset's bodies are byte-equal to today's.
- [ ] Preset file tests: the three blocks round-trip; a missing or bad block is named.
- [ ] Component tests: Edit and Preview on all three prompts; Options under Pick and Lookup.
- [ ] The four gates are green.
