# 13: Selection Narrowing

Status: ready-for-agent
Blocked by: 06, 12
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: This changes which tests guard every landing, so it is the highest-risk ticket in the effort.

Parent: [Test Sweep spec](../spec.md)

## What to build

Selection gets narrower only where the harness proves it safe (Q12). Candidates are type-only edges, barrel fan-out and mock-factory closures, plus `recordDependencies` if ticket 1 adopted it. Path triggers stay for `fs` reads. Each miss, including those ticket 6 listed, gets a rule or blocks that narrowing. The full suite still runs on push, at close-spec and at release (Q13).

Heavy runs wait for the owner's AFK signal (Q6).

Rulings: Q2, Q6, Q12, Q13.

## Acceptance criteria

- [ ] The harness reports zero misses on the narrowed selection, with its sample size and upper bound.
- [ ] Precision before and after, and affected-gate time before and after, are recorded.
- [ ] Each rule has a test that goes red when the rule is removed.

For you: Accept or reject the narrowing, from the harness result and its sample size.
