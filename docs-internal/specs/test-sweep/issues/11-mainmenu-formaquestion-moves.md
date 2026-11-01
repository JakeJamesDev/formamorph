# 11: MainMenu And Formaquestion Moves

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: The pattern is set, but the age gate sits in a Q5 area.

Parent: [Test Sweep spec](../spec.md)

## What to build

`MainMenu` and Formaquestion panel tests move to the right level (Q7). Age gate tests sit in a Q5 area and keep their mutation kills.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q5, Q7, Q22, Q23.

## Acceptance criteria

- [ ] Time before and after is recorded per family in the ticket.
- [ ] Q5 tests keep their mutation kills; other tests show held coverage and one reinstated bug turning red.
