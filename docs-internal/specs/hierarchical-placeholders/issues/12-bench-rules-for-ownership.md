# 12 — Test Bench rules for ownership and sharing

Status: done
Blocked by: 11

Spec: `../ownership-spec.md` (Implementation Decisions).

## Scope

Findings for the conditions tickets 09–11 create. Each is diagnosable only from world data, so each belongs in
the rules pass rather than in a component.

- A shared row weights a value its original no longer carries — a weight applying to nothing. The linked twin
  of the rule that already covers a placeholder's own weights.
- An owned placeholder its owner no longer holds as a value. Only a hand-edited file reaches this state, and
  it resolves nowhere, so the tree would otherwise be the only place it appears.
- An owned placeholder whose owner does not exist.
- Review the existing placeholder rules against the new vocabulary: the wording sweep from ticket 08 named
  Objects and Variables, and ownership adds "owned", "shared" and "the original". One term per thing.
- Confirm the existing dangling, cycle and slot-miss rules still read correctly when the chip they describe is
  a shared row rather than a plain value.

## Done

- Tests: each new rule fires on the condition and stays silent on a clean world, at the existing rules seam.
  Mutation-proven where guarding.
- The whole rule set runs clean against `saltmarsh-reach.json` except its deliberately broken corner, which
  raises exactly its own findings and no others.
- Four gates green; changelog entry appended.
