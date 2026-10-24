# 04: Elapsed Turn Timer

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one timer in an existing component, with a clear start point and fake-timer tests.

## What to build

The status strip shows how long the turn has run (Q4). The timer starts when the turn's first request starts and counts the whole turn, not each request. A Tool row in the same turn shares that start. The timer is hidden for the first 3 s, then shows whole seconds at the end of the strip. It shows on the turn row and the Tool row, never on the background pass row (Q11). It resets when the next turn starts. It stops when the turn ends or the player stops it.

Spec: Q4, Q11; stories 19–21.

## Acceptance criteria

- [ ] Status-row test with fake timers: no timer before 3 s; whole seconds after it
- [ ] The timer keeps counting across request changes in one turn (Plan → Narration → Choices) and does not restart per request
- [ ] The timer resets on the next turn
- [ ] The background pass row never shows a timer
- [ ] Frame: `.scratch/frames/timer-pages-desktop-dark.png` with the timer showing
- [ ] Changelog fragment written (fold into ticket 01's entry when it is unreleased)
