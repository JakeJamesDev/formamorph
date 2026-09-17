# 05: Custom Dialogue Color per Mode

Status: ready-for-agent
Blocked by: 01, 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/quote-color/spec.md`

## What to build

Under the **Quote Color** switch, a picker field sets a custom dialogue color for the active mode. Light
and dark keep separate values. **Reset to Theme** clears the active mode's value so the theme token
applies again. Narration updates while the player drags.

## Acceptance criteria

- [ ] Two settings, custom light color and custom dark color, default unset, stored as 6-digit hex, living with the other settings defaults.
- [ ] The field shows only while the color switch is on and edits the value for the active mode.
- [ ] The settings layer writes the active mode's custom color onto the document root as an override; with no custom value the theme token applies.
- [ ] A custom color in one mode leaves the other mode on the theme color.
- [ ] Reset clears the active mode's value only.
- [ ] Copy per the settings copy rules.
- [ ] A GamePanels harness test covers a custom color reaching the root and reset clearing it; a mode switch shows the other value.
- [ ] Verified in the preview via the dev-router in both modes.
- [ ] Changelog In-Progress entry. Four gates green.
