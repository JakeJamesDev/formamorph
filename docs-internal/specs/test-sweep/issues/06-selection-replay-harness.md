# 06: Selection Replay Harness

Status: ready-for-agent
Blocked by: 04, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Sound scoring design is the hard part; a weak harness would falsely approve narrowing.

Parent: [Test Sweep spec](../spec.md)

## What to build

A harness scores selection with injected bugs (Q12). It applies a landing's non-test diff to the tests from before that landing, adds sampled mutants, and requires every red test to be selected. It also reports precision, its sample size and rule-of-three upper bound. A replay can use its own install, because the lockfile changed often.

The ticket scores today's selection and records the result as the starting number. Heavy runs wait for the owner's AFK signal (Q6).

Rulings: Q6, Q12, Q26.

## Acceptance criteria

- [ ] A known selection gap, put back on purpose, makes the harness report a miss; a test proves it.
- [ ] Selecting every test reports zero misses and a low precision, so over-selection cannot pass unnoticed.
- [ ] A summary records today's misses, precision, sample size and upper bound.
- [ ] Each miss in today's selection is listed for ticket 13.

For you: Decide whether the sample size is enough, from the harness summary.
