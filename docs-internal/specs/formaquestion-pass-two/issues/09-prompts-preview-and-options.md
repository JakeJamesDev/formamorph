# 09: Prompts Edit | Preview and Pick/Lookup options

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Every help prompt gets the Edit | Preview tabs, and every request gets its own options.

- Each prompt field renders with Edit and Preview, the help chips resolved from the current settings. No Values tab.
- A help preset holds one options block per prompt: Answer, Pick and Lookup each with temperature, repetition penalty and Max Output. The Default preset's Pick and Lookup blocks follow the code and equal today's pinned values. Each prompt row gets an Options sub-row with the shared per-prompt controls.
- The help session reads each request's options from its own block. Compare to Default and Reset to Default cover the three blocks.
- The preset file carries the three blocks and bumps its version; an older file imports with Pick and Lookup at the Default's values. Export-shape change: say so in the response.

Spec: Q5; Implementation → Help presets and the preset file, Prompts tab.

Recommended model rationale: a preset shape change with a file version bump, session plumbing and tab rows in one slice.

## Acceptance criteria

- [ ] Session tests: the pick and lookup requests carry their blocks; the Default preset's bodies are byte-equal to today's.
- [ ] Preset file tests: the three blocks round-trip; an older file imports with defaults; a bad block is named.
- [ ] Component tests: Edit and Preview on all three prompts; Options under Pick and Lookup; Reset and Compare cover them.
- [ ] The four gates are green.
