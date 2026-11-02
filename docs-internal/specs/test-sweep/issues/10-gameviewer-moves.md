# 10: GameViewer Moves

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: GameViewer is the god node and much of it sits in Q5 areas, so proof runs matter.

Parent: [Test Sweep spec](../spec.md)

## What to build

`GameViewer` panel tests move to the right level (Q7). Turn pipeline, prompt and save tests sit in Q5 areas and keep their mutation kills. The slowest file loads every bundled save for 132 s; decide from the ledger which of its cases the view must run, and keep the migration guarantee.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q5, Q7, Q22, Q23.

## Acceptance criteria

- [ ] Time before and after is recorded per family file in the ticket.
- [ ] Q5 tests keep their mutation kills; other tests show held coverage and one reinstated bug turning red.
- [ ] Every bundled save still loads in a test.
