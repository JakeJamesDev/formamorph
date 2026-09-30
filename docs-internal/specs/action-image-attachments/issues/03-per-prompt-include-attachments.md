# 03: Per-Prompt Include Attachments

Status: ready-for-human
Base: 69487fd3
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

Each prompt on the Prompts tab gets an **Include Attachments** toggle. Narration defaults on and every other prompt defaults off. The Turn Plan reads the toggle for every pass, so a preset author can send the images to, for example, the director or the stat pass. The toggle travels in the preset share code and the preset JSON. The toggles are hidden when Image Attachments is off, and their stored values stay.

⚠️ Export-shape change (additive): each prompt entry in a prompt preset gets an optional flag. A missing flag takes its default. The feature is unreleased, so there is no migration.

## Acceptance criteria

- [x] Every pass that receives the player action honors its prompt's flag. The parts go after the final user text, the same way as ticket 01.
- [x] Default flags: Narration on, all others off. An older preset with no flags gets these defaults.
- [x] The flag round-trips through the share code and the preset JSON.
- [x] The toggles are hidden when the setting is off.
- [x] Tests: turn runner (a non-Narration pass with the flag on carries parts, a pass with it off carries none); prompt presets (round trip, defaults on a missing flag).
