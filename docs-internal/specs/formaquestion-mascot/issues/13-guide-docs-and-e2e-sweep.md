# 13: Guide docs and end-to-end sweep

Status: ready-for-agent
Blocked by: 04, 06, 09, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The feature is documented and the layouts are proven in a browser.

- The Formaquestion guide gets a Mascot section: what it does, the tab's rows, the picks, the Mask, the card, the transition. Help copy follows the writing guide.
- A Playwright sweep over the finished window: the three pieces side by side, the mobile head, the reader from a source name, the open motion, a face change with the default transition. Earlier tickets' specs are reused where they exist.

Recommended model rationale: docs and browser checks over finished behavior.

## Acceptance criteria

- [ ] The guide section exists and reads in the player-facing voice.
- [ ] The Playwright sweep passes on the e2e port.
- [ ] The four gates are green.
