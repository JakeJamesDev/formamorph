# 01: Budget Function and Request Body

Status: ready-for-human
Base: 32088801
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: `docs-internal/specs/reasoning-budget-base/spec.md` (rulings Q1–Q9, Q13, Q14).

## What to build

A reasoning-on prompt gets its thinking room on top of its answer room. The request sends `max_tokens` = answer cap + thinking budget, where the budget is a percent of the Max Output of the endpoint the prompt routes to. A short prompt such as Memory Selector keeps its full answer cap and still gets a real budget.

One pure function computes the budget and the total cap from the resolved effort, the prompt kind, the stored percents, the base (the routed endpoint's Max Output, the built-in engine's max tokens, or none) and the answer cap. The request spec calls it. Tickets 02 and 03 call the same function.

Workload rationale: this touches the request spec, the dialect writer and the off-signal path, and rewrites the tests that pin budget-inside-cap. Opus at high effort for the dialect edge cases.

## Acceptance criteria

- [x] With reasoning on, the budget is `round(pct% × base)` and `max_tokens` is answer cap + budget. The base is the routed target's Max Output, or the engine's max tokens on the built-in engine. The prompt's own cap (custom row, shipped cap, or endpoint Max Output) sets the answer only.
- [x] Override off, reasoning on: no budget field, no headroom, `max_tokens` is the answer cap alone (or absent for narration, as today).
- [x] Effort `none`: the dialect's 0 budget goes out with or without a base, and no headroom is added.
- [x] A dialect with a budget floor applies the floor before the headroom, so the budget stays under the cap. With no base, it sends the floor and `max_tokens` = answer cap + floor.
- [x] A level-only dialect sends its level and the same headroom.
- [x] The percent clamps to 5–150 in the resolver and to 150 in the shared-preset import (150 survives, 200 clamps).
- [x] Reasoning off for a prompt sends the same body as today.
- [x] Request-spec tests cover each case above with the routed endpoint as base. Tests that pinned budget-inside-cap are rewritten, not deleted. Put back the prompt-cap base and watch them fail.
- [x] The stat-pass spill memo and the model research notes each get a line that points at this spec.
- [x] Changelog line in 🚧 In Progress, and a reminder in the reply that shared presets can now carry `reasoningBudget` up to 150.
- [x] Four gates green.
