# 03: Pill fade over her head

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Under Bubble in full view, the pill over her head stays out of the way until the player wants it.

- The pill shows when the window opens, fades out after a short delay, and fades back on hover over her or the pill, or on keyboard focus inside the pill. Leaving re-arms the delay.
- On a touch device the pill stays visible. Under reduced motion it shows and hides with no fade.
- The Mascot grip (ticket 01) fades and returns with the pill, on the same state.
- The delay is one named constant, set from the live window after the build.
- Head view and the other chromes are unchanged: their pill never fades.

Spec: Q5, Q19; Implementation → Window (pill fade).

Recommended model rationale: a timer and hover state on one component, with fake-timer tests; small, contained work.

## Acceptance criteria

- [ ] Render tests with fake timers: the pill is visible on open, hidden after the delay, visible again on hover and on focus, and hidden again after leaving.
- [ ] The Mascot grip hides and shows with the pill.
- [ ] A touch device keeps the pill visible; reduced motion drops the fade transition.
- [ ] The head view's pill and the Minimal and Full pills never fade.
- [ ] Changelog folded into the Bubble entry. The four gates are green.
