# 03 — Test Bench rules for structured placeholders

Status: done
Blocked by: 01, 02

Spec: `../spec.md` (Implementation Decisions: Diagnostics).

## Scope

Five rules in the existing rule engine, no new UI and no quick fixes:

- Slot miss: a placed slot path some sibling value cannot satisfy.
- Dangling reference: a chip whose target placeholder no longer exists.
- Reference cycle.
- Empty record join: a record whose whole placement resolves to nothing.
- Duplicate slot names under one placeholder (first match wins at resolve; surface the ambiguity).

## Done

- Rules follow the engine's registry conventions; findings asserted per rule, each guard proven
  by reinstating its bug once (no rigged worlds).
- Existing rules and fixtures untouched and green.
- Four gates green.
