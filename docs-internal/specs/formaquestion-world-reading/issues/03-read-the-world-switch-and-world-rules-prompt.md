# 03: Read the World Switch and World Rules Prompt

Status: ready-for-agent
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

- [ ] The switch shows in Formaquestion's settings, on by default, with the endpoint line
- [ ] The world-rules prompt is editable and resets to its built-in text
- [ ] A help preset file from before this change loads, with the switch on and the built-in world rules
- [ ] A file with both keys round-trips through export and import
- [ ] A file missing another required entry is still refused
- [ ] Frames `.scratch/frames/read-the-world-setting.png`, light and dark, desktop width

For you: read the world-rules prompt's built-in text in Formaquestion's prompt settings.
