# 05: Field Pulse on Controls and Chips

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: it applies the field identity from 04 to more control kinds.

Parent: [History Reveal Origin spec](../spec.md)

## What to build

Switches, sliders, selects and color pickers carry the field identity, so their edits pulse the control after undo and redo (Q6). An inline chip edit records its host field, the field that holds focus, and reveal pulses that host field. Canvas drags record no field, and reveal stops at the record.

## Acceptance criteria

- [ ] A switch, a slider, a select and a color picker each pulse after undo.
- [ ] A slider drag group pulses the slider.
- [ ] An inline chip edit pulses the host prompt field on the host's tab.
- [ ] A canvas drag reveals the record with no pulse.
- [ ] Bench tests for each control kind and for a chip.
