# 10: Test Bench rules

Status: ready-for-human
Base: bdc06209
Blocked by: 06 — Pins by blueprint; 07 — Blueprint chips
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Rationale: four rules on the existing pure `runRules` seam, with the pin rules as prior art. Trait-links ticket 11's bearer-relative pin rules are replaced.

Parent: [Blueprints spec](../spec.md)

## What to build

The Test Bench warns when a copy removes the value a pin names, when a blueprint chip sits in a field that refuses it, and when a bearer pins a blueprint it holds no copy of. It notes when an edited copy has no trait or chip that uses it. Each finding jumps to the copy, field or bearer it names. The two trait-links rules for bearer-relative pins are removed with the feature.

## Acceptance criteria

- [x] Rule tests cover each of the four findings and its clean case.
- [x] Each finding's jump target opens the right row.
- [x] The bearer-relative pin rules and their tests are gone.
- [x] Each guard is proven to fail with its rule removed.
