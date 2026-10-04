# 01: Readability prototype

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A prototype page that lets the user pick how the minimal chat separates from what is behind it.

- Runs on the prototype flow: its own worktree, branch and port.
- One page renders the minimal column three times side by side over the same background: a scrim with an opacity slider behind the column, shadows on the bubbles, and a text halo. A control swaps the background between a light screen, a dark screen and a scene image.
- The user picks from static frames. The pick, its range and its default go into the spec as a ruling.

Spec: Q8; Implementation → Prototype.

Recommended model rationale: a standalone page with three CSS treatments; no app code changes.

## Acceptance criteria

- [ ] The page shows the three treatments over the three backgrounds, with the scrim at a slider.
- [ ] Frames of each treatment on each background are in the ticket's Answer.
- [ ] The ruling (treatment, range, default) is written into the spec before ticket 11 starts.
