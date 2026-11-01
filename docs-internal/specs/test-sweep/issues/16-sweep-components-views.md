# 16: Sweep Components And Views

Status: ready-for-agent
Blocked by: 13, 14, 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Deletion judgment across the most expensive tests.

Parent: [Test Sweep spec](../spec.md)

## What to build

The ledger's slowest remaining tests in `src/components` and `src/views` go through the Q8 bar one at a time. A test with real-bug history follows Q9. Weak or mock-only tests are strengthened when they alone cover a behavior and deleted otherwise (Q22). If the candidates exceed one session, stop at a clean batch and name the remainder for the spec session.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q4, Q5, Q8, Q9, Q22, Q23.

## Acceptance criteria

- [ ] A deletion list names each test and its reason.
- [ ] Each strengthened test is listed, and it fails when its behavior is broken.
- [ ] Time saved is recorded, along with any candidates left unswept.
