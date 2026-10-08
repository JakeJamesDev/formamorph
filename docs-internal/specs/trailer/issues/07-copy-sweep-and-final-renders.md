# 07: Copy Sweep And Final Renders

Status: ready-for-agent
Blocked by: 05, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a copy pass and a spec check; no new components.

Parent: [Trailer spec](../spec.md)

## What to build

The final pass before the trailer is handed over.

- Every line of on-screen copy goes through the copy sweep.
- Both cuts re-render after the sweep.
- The wide cut is checked line by line against the Steam spec in the spec file: resolution, frame rate, bitrate, container, codec, aspect ratio.
- The package README records where the renders land and how to re-render after a release.

## Acceptance criteria

- [ ] The copy sweep passes on every scene's copy.
- [ ] Both final MP4s and the poster frame exist from a fresh render.
- [ ] The Steam spec check is recorded in the ticket with the measured values.
