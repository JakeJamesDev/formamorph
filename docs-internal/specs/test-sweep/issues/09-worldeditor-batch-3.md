# 09: WorldEditor Batch 3

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: Repeats a set pattern; judgment is limited to following it and its proof recipe.

Parent: [Test Sweep spec](../spec.md)

## What to build

The second batch the pilot's note assigns moves off the full view mount (Q7), using the pilot's pattern and helpers.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q7, Q22, Q23.

## Acceptance criteria

- [ ] Only tests the note assigned to this batch moved.
- [ ] Time before and after is recorded in the ticket.
- [ ] Q5 tests keep their mutation kills; other tests show held coverage and one reinstated bug turning red.
- [ ] The `panelWorld` and harness copies in `panelBench` are gone once the view moves end, and `worldEditorBench` changes only then.
