# 05: Review fold-in

Status: done
Blocked by: 01, 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The small gaps the spec review found after tickets 01 to 03 landed.

- With no exchange, she shows the Initial look in every chrome. Clear Conversation returns her to it (Q28). Today the Initial look ends for good at the app load's first question.
- The Bubble sections of the Formaquestion guide and the Design System doc describe the pill fade: shows on open, hides after one second, returns on hover over her or a piece, on keyboard focus, and while the ⋮ menu is open; touch keeps it up; reduced motion drops the transition (Q5, Q26).
- A render test covers the flagged answer's nearest sections in the Sources popover (Q22).
- The shared pill's unused class prop goes.
- Q11 and Q20 are confirmed as built: the reader anchors to the chat room's top; the vertical grip icon stays in Minimal too. No code change for either.

Spec: Q5, Q11, Q20, Q22, Q26, Q28.

Recommended model rationale: one phase-rule change with tests, two doc paragraphs, one test, one prop removal.

## Acceptance criteria

- [ ] Phase tests: Clear Conversation with no exchange left shows the Initial look; a question in progress still shows Thinking; the first answer ends Initial.
- [ ] Guard bites: restoring the app-load rule turns the Clear test red.
- [ ] The two docs describe the fade; the copy sweep passes.
- [ ] The flagged Sources popover test renders the nearest sections.
- [ ] No unused prop on the pill. Changelog folded into the Bubble entry. The four gates are green.
