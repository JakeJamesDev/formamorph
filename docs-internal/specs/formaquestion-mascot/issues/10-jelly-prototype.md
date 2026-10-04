# 10: Jelly prototype

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A throwaway page that settles the Jelly transition before it is built. Runs through the prototype flow, on its own branch.

- A standalone page shows the default rig and swaps its face on a button. Sliders: duration, squash, overshoot, settle count. The page plays the swap as the spec describes: scale from the bottom center, squash below normal, stretch past normal, yoyo settle; the face swap lands at the squash.
- The page prints the sampled scale per frame, so the shape is on record. Watching it is the user's job; no self-driven visual checks.
- Output: the default tuning, the slider ranges, and the timing function's shape, written into the spec's Transition section as a ruling note. The function itself is lifted into ticket 11.

Spec: Q31; Further Notes → Jelly prototype.

Recommended model rationale: an easing design loop where the function's shape is the deliverable.

## Acceptance criteria

- [ ] The page runs from the prototype's own launch entry and swaps the face under the four sliders.
- [ ] Per-frame scale samples print for each run.
- [ ] The spec's Transition section records the chosen defaults, the ranges and the function's shape.
- [ ] The branch holds the page; nothing lands on main from this ticket.
