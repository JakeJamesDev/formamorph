# 03: Read the World Switch and World Rules Prompt

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a shape change to a released file, small in code but with a compatibility rule that must hold.

## What to build

Formaquestion's settings gain a **Read the World** switch (working label), on by default and stored per device with the other help settings. Its help line says that world text goes to the connected endpoint.

The help preset gains a **world rules** prompt, editable like the other four. Its built-in text holds the two leans: how-it-works in the World Editor; lore so far, opinion-not-solution and no speculation about unshown plot in game. Ticket 04 sends it; this ticket defines it.

⚠️ **Export shape:** the help preset file gains the switch and the prompt. The file has been in released builds since v3.2.0. A file without either key loads with the built-in default; today the parser refuses a file missing an expected entry, so that rule changes for these two keys only.

Spec: Q7, Q19, Q23; stories 28–32.

## Acceptance criteria

- [x] The switch shows in Formaquestion's settings, on by default, with the endpoint line: `Formaquestion.settings.test.tsx` (default checkbox list, hint, remount)
- [x] The world-rules prompt is editable and resets to its built-in text: split into **Editor World** and **Game World** riders (spec-session ruling); `FormaquestionPromptsTab.test.tsx` "the world rules in the Prompts tab"
- [x] A help preset file from before this change loads, with the switch on and the built-in world rules: `helpPresetFile.test.ts` "loads a file from before Read the World…"; stored device presets too, `helpPresets.test.ts`. Both guards mutation-tested red
- [x] A file with both keys round-trips through export and import: `helpPresetFile.test.ts` "gives the same texts…" with edited world rules and the switch off
- [x] A file missing another required entry is still refused: `helpPresetFile.test.ts` "a missing prompt beside missing world rules" → `prompts.pick`
- [x] Frames, light and dark, desktop width (1440×900): `.scratch/formaquestion-world-reading-03/frames/read-the-world-setting.png` and `read-the-world-setting-dark.png`

## Landed

**Not verified**
- None.

**For you**
- For you: read the world-rules prompt's built-in text in Formaquestion's prompt settings. (Prompts tab → **Editor World** and **Game World**.)
- Importing a preset file from before this change turns **Read the World** on, even if you had it off. This follows the ruling; say if an old file should leave the switch alone instead.
- No probe ran: nothing sends the world rules until 04 and 05. Ticket 07's baseline measures them.
