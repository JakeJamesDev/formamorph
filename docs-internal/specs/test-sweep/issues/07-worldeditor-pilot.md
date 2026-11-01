# 07: WorldEditor Pilot Batch

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: It sets the pattern and any shared test helpers that three later batches follow.

Parent: [Test Sweep spec](../spec.md)

## What to build

One group of `WorldEditor` panel tests moves off the full view mount (Q7). Pick the group from the ledger with the most time saved per file outside Q5 areas. Panel behavior moves to component tests or merges into them, and the view keeps its wiring tests. The ticket writes a short pattern note covering what stays a view test, and it owns any shared test helper later batches need.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q7, Q17, Q22, Q23.

## Acceptance criteria

- [ ] The moved tests' time before and after is recorded in the ticket.
- [ ] The kept-protection check shows no lost coverage on the modules under test.
- [ ] One reinstated bug in the moved behavior turns a moved test red.
- [ ] The pattern note lands in the spec folder, and the batches for tickets 8 and 9 are listed in it.
