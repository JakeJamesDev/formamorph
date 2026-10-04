# 06: Docs line and end-to-end sweep

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The guide describes the button, and Playwright proves the jump.

- The Formaquestion guide page gains a short description of Take Me There, in the docs voice. Because a docs edit can move the AI Picks list, the recall probe runs once after and the Answer reports it.
- Playwright: one jump from an answer to a Settings tab, and one refused jump from a running game that leaves the game untouched.
- A changelog line in 🚧 In Progress.

Spec: Testing Decisions → Playwright.

Recommended model rationale: a docs paragraph and two e2e cases on a finished feature.

## Acceptance criteria

- [ ] The guide page describes the button; the recall probe number is in the Answer.
- [ ] Both Playwright cases pass.
- [ ] The changelog line is present.
- [ ] The four gates are green.
