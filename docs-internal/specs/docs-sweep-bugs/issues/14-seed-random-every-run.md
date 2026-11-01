# 14: Seed Math.random on Every Run

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: drop one gate in the executor and add an injectable seed source for the test.

## What to build

Stat code gets a fresh `Math.random` seed only on Tool runs. Every other run uses QuickJS's clock seed, so two scripts that start in one millisecond draw the same numbers. Seed every run from `crypto.getRandomValues`, with the seed source injectable for the test (Q11).

Spec: Q11, Implementation Decisions "Random seed". Evidence: docs-sweep ticket 13, Landed.

## Acceptance criteria

- [ ] A test runs a non-Tool script twice with one injected seed and gets the same draw, then with two seeds and gets different draws: it fails today, then passes
- [ ] Tool runs keep their fresh seed (existing tests green)
- [ ] Scripts-Reference says each run draws its own random numbers, beside the random examples; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
