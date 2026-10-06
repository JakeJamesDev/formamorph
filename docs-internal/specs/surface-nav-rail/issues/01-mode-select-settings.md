# 01: Mode Select In Settings

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: one new shared component, one adopting screen, its existing tests retargeted, and a showcase entry; contained.

## What to build

A shared **Mode Select** replaces the Simple/Advanced segmented control in the Settings window (Q6, Q24). The trigger is 7.5rem wide whatever its value and shows the current mode. Its list describes each mode on a second line; Settings reads "Just the essentials" and "Every setting". The hidden-settings dot and its tooltip ride the trigger.

The component forwards its ref and attributes to the trigger, so the Settings tutorial note and the Take Me There targets that land on the mode control keep landing. Its tooltip sits on a wrapping element so the trigger keeps that ref (the composed-forwardref lint rule). The component takes the descriptions as input so the World Editor can reuse it in ticket 05 with its own wording.

The Design System guide gains "Pattern: Mode Select" with a showcase entry, replacing the Simple/Advanced switch's entry. The Settings guide names the select where it names the switch. Changelog fragment: the lead **The World Editor and Community Creations move their sections to a collapsible side rail.** and a sentence on Settings' mode select.

From the prototype branch `prototype/world-editor-tabs` (final commit `dbe3c035`, Community header `54a3e233`); launch entry `proto-world-editor-tabs`, port 5245.

## Acceptance criteria

- [ ] Settings shows the Mode Select in the header; picking Advanced reveals Advanced settings, picking Simple hides them.
- [ ] The trigger measures the same width in both modes.
- [ ] The list shows both modes with their one-line descriptions.
- [ ] The dot shows only while Simple hides a setting that is off its default, with its accessible name.
- [ ] The Settings tutorial note and the mode-switch Take Me There targets still land on the control.
- [ ] Existing Settings mode tests target the select; the Design System showcase test covers the new entry.
- [ ] Guard bites: forcing the dot on with nothing hidden turns the dot test red.
- [ ] Design System and Settings guides updated; changelog fragment written.
- [ ] Gates green.

## Blocked by

- None (can start immediately)
