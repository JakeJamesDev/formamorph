# 03: Roll Tool

Status: ready-for-human
Base: bdb99575
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: one short sandbox script and its catalog entry; the runner's script tests are prior art.

## What to build

The AI calls `roll` with dice notation and gets each die, the modifier, and the total. The Tool is a catalog script Tool, off by default, locked in the editor, and its script is short enough for a player to read and trust. Notation accepts `NdS`, `dS`, `NdS+K`, and `NdS-K`, ignores spaces and case, and enforces the count, sides, and modifier limits from the spec. Bad input returns text that names the problem and gives one valid example. Each run uses the sandbox's own random source.

## Acceptance criteria

- [x] `roll` listed on every preset, default off, locked, Offered To narration
- [x] Output is `{"dice", "rolls", "modifier", "total"}` with total equal to the dice plus the modifier
- [x] Each notation form, a negative modifier, and every limit edge covered; bad notation returns the error text
- [x] Randomness checked by range over many runs, never by a fixed value
- [x] Try It works with and without a world open
- [x] Four gates green, `graphify update .` run, In-Progress changelog entry added
