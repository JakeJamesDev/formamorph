# 09: Mobile Performance

Status: ready-for-agent
Blocked by: 05, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Layered pictures stay smooth on mobile. The spec covers this in its Rendering section.

- Measure an eight-Layer full-size rig at mobile width on a realistic device profile. Record frame times while narration streams and during a transition, and decoded image memory.
- If play stutters, draw the settled stack as one flattened bitmap (ticket 07's flatten), cached by the stack's state. Use separate Layer elements only during a transition.
- Record the numbers before and after in the ticket's Landed section.

## Acceptance criteria

- [ ] Numbers recorded for the eight-Layer rig at mobile width, with the method.
- [ ] If the cache was added, a test proves a state change rebuilds it and an unchanged state reuses it.
- [ ] Changelog fragment written, only if behavior changed.

For you: play a layered world on the Android build and judge smoothness (entity panel, backdrop).
