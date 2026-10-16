# 04: At Game Start Timing

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: one new seam before the opening call, with the existing runner doing the work.

## What to build

A script with timing At Game Start runs once per new playthrough, after setup, before the opening AI call. Its writes shape the opening prompt. It never runs on load of a save (Q11).

Spec: Q11, story 6.

## Acceptance criteria

- [ ] A start script's stat write shows in the opening request; a test reads the request body
- [ ] Loading a save runs no start script; a guard test proves it
- [ ] The runner's owner order and the trait gate apply to this timing
- [ ] Four gates green

## Blocked by

- 01
