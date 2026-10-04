# 13: Guide docs and end-to-end sweep

Status: ready-for-human
Blocked by: 04, 06, 09, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The feature is documented and the layouts are proven in a browser.

- The Formaquestion guide already has a short Mascot section from ticket 07 (the docs-coverage guard wants one per surface). Extend it, never add a second: what it does, the tab's rows, the picks, the Mask, the card, the transition. Help copy follows the writing guide.
- The Design System reference gains the minimal chrome under the Formaquestion pattern: the pill, the floating pieces, the question bubble on the primary fill and the answer in a bubble, which the framed window's bubble rules do not say. The showcase shows it.
- The glossary's Mascot and Voice entries are checked against the finished tab's labels.
- A Playwright sweep over the finished window: the three pieces side by side, the mobile head, the reader from a source name, the open motion, a face change with the default transition. Earlier tickets' specs are reused where they exist.

Recommended model rationale: docs and browser checks over finished behavior.

## Acceptance criteria

- [ ] The guide section exists and reads in the player-facing voice.
- [ ] The Design System reference and showcase cover the minimal chrome and its bubbles.
- [ ] The Playwright sweep passes on the e2e port.
- [ ] The four gates are green.
