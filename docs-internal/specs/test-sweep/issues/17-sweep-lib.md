# 17: Sweep Lib

Status: ready-for-agent
Blocked by: 13, 14, 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Most Q5 logic lives here, so mutation proof and judgment matter more than speed.

Parent: [Test Sweep spec](../spec.md)

## What to build

`src/lib` goes through the Q8 bar. Time savings here are small, at 4% of test body time, so the aim is value: duplicates, weak assertions, mirrored logic and change detectors. Coverage counts only for the module under test, so a view mount's accidental coverage never condemns a library test. Q5 modules holding candidates get mutation runs, which wait for the owner's AFK signal. If the candidates exceed one session, stop at a clean batch and name the remainder for the spec session.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q4, Q5, Q6, Q8, Q9, Q22.

## Acceptance criteria

- [ ] A deletion list names each test and its reason.
- [ ] Each Q5 deletion has a mutation result showing no lost kills.
- [ ] Each strengthened test is listed, and it fails when its behavior is broken.
- [ ] Any candidates left unswept are listed.
