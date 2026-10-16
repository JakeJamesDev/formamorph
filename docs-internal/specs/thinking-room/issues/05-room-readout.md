# 05: Room Readout

Status: done
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one display in an existing settings field, following the Design System and the copy sweep.

## What to build

Where a prompt's reasoning field shows no budget slider, a readout beside the strength shows the room, such as "Low · 1,024 tok". It updates when the strength changes. On a budget target with Max Output off, the readout replaces the slider and its "no base" note. With Max Output set, the slider shows as today. Verify in the live preview through the dev-router.

Spec: Q11, Q13; stories 8–10.

## Acceptance criteria

- [ ] A no-budget target shows "‹Strength› · N tok" with the table's number, and Model Default shows Medium's
- [ ] Changing the strength updates the readout
- [ ] A budget target with Max Output off shows the readout and no slider or "no base" note
- [ ] A budget target with Max Output set shows the slider unchanged
- [ ] Both themes checked in the preview
- [ ] Four gates green
