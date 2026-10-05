# 08: Reset and Compare in Formaquestion

Status: done
Blocked by: 02, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Formaquestion prompt's Reset and Compare move to the modal footer with the shared labels and dialog.

- Reset then Compare, right-aligned, in the footer. The label row no longer holds them, so the phone-width overlap is gone.
- The shared compare dialog replaces the Formaquestion one.
- The Options view shows neither.

Spec: Q11, Q13, Q15; Implementation → Reset and Compare.

Recommended model rationale: moving two buttons and swapping a dialog on one surface.

## Acceptance criteria

- [ ] The pair sits in the footer in the same order and alignment as Settings.
- [ ] At 375px the prompt label is not covered.
- [ ] The Formaquestion prompts test passes with the new placement.
- [ ] Changelog line under In Progress.
