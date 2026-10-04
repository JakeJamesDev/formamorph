# 05: Scroll arrow

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Both chats show a small down-arrow button when the player has scrolled away from the end.

- A pure rule: shown when the end is more than half a viewport height away.
- A round button at the bottom center of the conversation viewport, above the input, in the minimal column and the full frame. A click scrolls to the end and resumes following; the arrow leaves when following resumes. Reduced motion drops its animation.

Spec: Q13; Implementation → Window layout module, Window.

Recommended model rationale: a small rule plus one component in two scrollers.

## Acceptance criteria

- [ ] Rule tests at the threshold and on both sides of it.
- [ ] Component tests: the arrow renders past the threshold in both chromes, a click scrolls to the end and it leaves.
- [ ] Playwright: the arrow's painted place above the input.
- [ ] The four gates are green.
