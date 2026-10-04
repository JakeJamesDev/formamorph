# 03: Phases: Initial, Thinking and Idle

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The character reacts to the conversation without any AI involvement.

- The first open in an app load shows the Initial composition (the wave). It holds until the first send. A later open in the same load shows Idle.
- Sending a question sets the thinking phase and shows the Thinking composition. It holds through the pick request, the prefill and any reasoning text, because the session yields nothing until the pick is done and reasoning arrives without content text.
- The first answer event with content text sets the answering phase: Idle shows (the AI's face comes in ticket 04).
- The phase lives in the mounted window, which lives for the app load.

Spec: Q8, Q9, Q10, Q18, Q30; Implementation → Window.

Recommended model rationale: window state driven by stream events, where the wrong event moves the face a token early.

## Acceptance criteria

- [ ] The wave shows on the first open of an app load and not on the second.
- [ ] Thinking shows on send and stays through a reasoning-only answer event.
- [ ] Idle shows at the first content token.
- [ ] A remount of the window inside the same app load does not replay the wave.
- [ ] The four gates are green.
