# 15: Owner-Tree Parity Harness

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the fixture every engine ticket proves itself against.

## What to build

A parity harness records the output of a fixed set of owned-trait and owned-stat drops on the bundled worlds. Later tickets run the same set through the new engine and compare.

Spec: Testing Decisions: parity test. Stories 25, 37.

## Acceptance criteria

- [ ] The set covers moves within an owner, across owners, onto the custom-persona root, with links on and off
- [ ] The harness passes against the current code
- [ ] Four gates green

## Blocked by

- None (can start immediately)
