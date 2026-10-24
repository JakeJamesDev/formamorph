# 04: Elapsed Turn Timer

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one timer in an existing component, with a clear start point and fake-timer tests.

## What to build

The status strip shows how long the turn has run (Q4). The timer starts when the turn's first request starts and counts the whole turn, not each request. A Tool row in the same turn shares that start. The timer is hidden for the first 3 s, then shows whole seconds at the end of the strip. It shows on the turn row and the Tool row, never on the background pass row (Q11). It resets when the next turn starts. It stops when the turn ends or the player stops it.

Spec: Q4, Q11; stories 19–21.

## Acceptance criteria

- [x] Status-row test with fake timers: no timer before 3 s; whole seconds after it (`shows no timer before 3 s and whole seconds after`)
- [x] The timer keeps counting across request changes in one turn (Plan → Narration → Choices) and does not restart per request (`keeps counting when the request label changes within one turn`; `isWaitingForAI` is set once per turn and cleared once, read in code)
- [x] The timer resets on the next turn (`resets when the next turn starts`)
- [x] The background pass row never shows a timer (`shows no timer on the background pass row`)
- [x] Frame: `.scratch/frames/timer-pages-desktop-dark.png` with the timer showing
- [x] Changelog fragment written (a fragment always lands as its own entry; ticket 01's entry stays as is)

## Landed

**Not verified**
- Chat layout frame: only the showcase strip was framed, not the live game in Pages or Chat. No game-level test covers `GameViewer`'s start ref.

**For you**
- Play a slow turn in Pages and Chat: the timer should pass 3 s, keep counting through Plan to Choices, and reset on the next turn.
- A partial re-roll (one request) also shows the timer, because it sets `isWaitingForAI`. Judge if that is right.
