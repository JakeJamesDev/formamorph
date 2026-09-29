# 01: Opening Card Fixes

Status: done
Base: 2d47fda4
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: [Openings Refresh](../spec.md) (stories 45, 55, 56; Q7)

## What to build

Three small fixes an author sees at once in the openings editors:

- The **Player Action | Narration** control in an opening card header keeps the selected value's pill inside its track. Fix the shared segmented control if it is the cause, not with a local override.
- **Openings** is the last tab in both entity editors (World Editor and library).
- The full-width add button under an owned group in the world Openings panel reads "Add Opening to <owner>" as its visible text.

## Acceptance criteria

- [ ] The selected pill fits the track at the card header's real width, checked in the live preview in both themes.
- [ ] Both entity editors list Openings last; the entity tab tests pin the order.
- [ ] The owned add button's visible text names its owner; the World Details suite asserts it.
- [ ] Four gates green; changelog In Progress entry.
