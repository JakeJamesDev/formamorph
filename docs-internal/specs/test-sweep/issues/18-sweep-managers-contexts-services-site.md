# 18: Sweep Managers, Contexts, Services And Site

Status: ready-for-agent
Blocked by: 13, 14, 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Storage and account paths sit in Q5 areas, so deletion judgment still matters.

Parent: [Test Sweep spec](../spec.md)

## What to build

`src/managers`, `src/contexts`, `src/services` and `site` go through the Q8 bar. Storage and account tests sit in Q5 areas. If the candidates exceed one session, stop at a clean batch and name the remainder for the spec session.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q4, Q5, Q6, Q8, Q9, Q22.

## Acceptance criteria

- [ ] A deletion list names each test and its reason.
- [ ] Each Q5 deletion has a mutation result showing no lost kills.
- [ ] Each strengthened test is listed, and it fails when its behavior is broken.
- [ ] Any candidates left unswept are listed.
