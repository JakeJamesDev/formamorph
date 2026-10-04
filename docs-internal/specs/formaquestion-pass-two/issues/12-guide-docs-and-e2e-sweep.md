# 12: Guide docs and e2e sweep

Status: ready-for-agent
Blocked by: 02, 03, 04, 05, 06, 07, 08, 09, 10, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player docs and the e2e suite cover the second pass.

- The Formaquestion guide page gains how-to sections for Chat Style, the readability setting, Scale, the Mask handles, the scroll arrow, the Endpoint editor and the per-prompt options, and says Lookup Mode starts on.
- Docs edits move the AI Picks list; run the recall probe and report it.
- One e2e pass over the new controls, and the changelog lines for the effort.

Spec: all; Testing → Playwright.

Recommended model rationale: docs in the help voice and a sweep of existing e2e patterns.

## Acceptance criteria

- [ ] Each new control has a how-to section in the help voice.
- [ ] The recall probe result is in the ticket's Answer.
- [ ] The e2e suite is green with the new checks.
- [ ] The four gates are green.
