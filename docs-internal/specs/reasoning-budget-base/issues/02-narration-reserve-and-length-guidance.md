# 02: Narration Reserve and Length Guidance

Status: ready-for-agent
Blocked by: 01 — Budget Function and Request Body
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/reasoning-budget-base/spec.md` (rulings Q12, Q15).

## What to build

A long thought never overflows the context window. The narration context reserve covers the answer cap plus the thinking budget when narration reasons, using the function from ticket 01. The narration length guidance reads the answer cap (the custom narration row, else the endpoint's Max Output), the same number the reserve starts from.

Workload rationale: a contained change in the narration context path with two tests. Sonnet at medium effort.

## Acceptance criteria

- [ ] With reasoning on for narration, the reserve equals the total cap from ticket 01's function. With reasoning off, it equals the answer cap, as today.
- [ ] Override off keeps today's behavior: no reserve and no guidance.
- [ ] A custom narration Max Output row moves both the reserve and the length guidance.
- [ ] One test for the reserve with reasoning on and off. One test that the row moves both numbers.
- [ ] Four gates green.

## Comments

**Handoff from ticket 01 (2026-09-27, commits 1d649f2f and 38d31dbc).** The shared function is `reasoningBudget({ effort, kind, budgets, base, answerCap, floor })` in the reasoning-effort module. Get `floor` from `reasoningDialectBudgetFloor(dialect)` where the record takes a budget, else 0. `MAX_REASONING_BUDGET_PCT` is 150. Its `maxTokens` assumes a reasoning signal: the request adds headroom only when a reasoning field goes out or the record answers `reasons: true` (Q16). Apply the same rule where you consume the function.
