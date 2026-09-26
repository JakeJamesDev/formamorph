# 03: Tool Switches on Built-in Presets

Status: ready-for-human
Base: 07896101
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: extends the enabled map from ticket 02 to a second preset kind with clear defaults; the store and harness tests already exist.

## What to build

A player flips a Tool's switch on a built-in preset without copying it. The switch is player state stored beside the preset store, keyed by the built-in preset id. A fresh install seeds each built-in preset's switches from the shipped defaults, so behavior on first run is unchanged. Prompt text on built-in presets stays read-only. The Tools tab no longer disables the row switch or asks for a preset copy on a built-in preset.

## Acceptance criteria

- [ ] Built-in presets hold an enabled map as player state; the shipped override constants are its defaults
- [ ] The row switch works on a built-in preset and persists across reload
- [ ] Copying a built-in preset carries its current switches, defaults included
- [ ] Built-in prompt text remains read-only
- [ ] Store tests cover defaults, a flipped switch, and the codec round trip; harness tests cover the switch on a built-in preset; each fails when its behavior is removed
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
