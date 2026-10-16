# 01: World Probe

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q8; Implementation Decisions › World probe)

## What to build

One probe that judges any bundled world against an older revision of itself on the cloud model. Every world ticket uses it for its Q8 evidence.

Extend the existing world-narration probe:

- Accept every bundled world by id.
- Accept arms: the working-tree world, or the world at a git revision. Default arms are the working tree and the revision before the refresh.
- Interleave arms within one batch, so each batch carries its own control. Default 5 runs per arm.
- Default to the cloud endpoint. Replicate the sampler pins and send `reasoning_effort: "none"`.
- Report structural metrics per arm: stat pass validity, token and reasoning leaks, choices parse, unresolved placeholder tokens.
- Write transcripts per arm in a form the baseline rubric can score, plus a summary table.

## Acceptance criteria

- [ ] The probe runs on all eight current worlds with two arms (working tree vs `HEAD`) and prints the summary table.
- [ ] Structural metric functions have unit tests, and each test is shown to fail when its metric is broken.
- [ ] A smoke run on the cloud endpoint for one world finishes, with its numbers in this ticket's comments.
- [ ] The harness README documents the arm syntax and the Q8 pass bar.
