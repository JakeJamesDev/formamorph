# 05: Field Pulse on Controls and Chips

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: it applies the field identity from 04 to more control kinds.

Parent: [History Reveal Origin spec](../spec.md)

## What to build

Checkboxes, selects and segmented groups carry the field identity, so their edits pulse the control after undo and redo (Q6). An inline chip edit records its host field, the field that holds focus, and reveal pulses that host field. Canvas drags record no field, and reveal stops at the record.

The World Editor mounts no slider and no color picker today (spec ruling Q17), so the slider, color picker and slider drag group criteria have no control to test. A checkbox stands in for the switch. A slider or color picker added later gets the identity by wearing a frame, as the other controls do.

## Acceptance criteria

- [x] A checkbox (the switch), a select and a segmented group each pulse after undo.
- [x] An inline chip edit pulses the host prompt field on the host's tab.
- [x] A canvas drag reveals the record with no pulse.
- [x] Bench tests for each control kind and for a chip.
