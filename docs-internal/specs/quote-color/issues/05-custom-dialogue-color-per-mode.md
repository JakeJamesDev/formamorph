# 05: Custom Dialogue Color per Mode

Status: ready-for-human
Base: 5989976e
Blocked by: 01, 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/quote-color/spec.md`

## What to build

Under the **Quote Color** switch, a picker field sets a custom dialogue color for the active mode. Light
and dark keep separate values. **Reset to Theme** clears the active mode's value so the theme token
applies again. Narration updates while the player drags.

## Acceptance criteria

- [x] Two settings, custom light color and custom dark color, default unset, stored as 6-digit hex, living with the other settings defaults.
- [x] The field shows only while the color switch is on and edits the value for the active mode.
- [x] The settings layer writes the active mode's custom color onto the document root as an override; with no custom value the theme token applies.
- [x] A custom color in one mode leaves the other mode on the theme color.
- [x] Reset clears the active mode's value only.
- [x] Copy per the settings copy rules.
- [x] A GamePanels harness test covers a custom color reaching the root and reset clearing it; a mode switch shows the other value.
- [x] Verified in the preview via the dev-router in both modes.
- [x] Changelog In-Progress entry. Four gates green.
