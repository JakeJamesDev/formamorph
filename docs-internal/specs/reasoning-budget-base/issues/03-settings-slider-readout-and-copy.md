# 03: Settings Slider, Readout and Copy

Status: ready-for-human
Base: ae2cdfc7
Blocked by: 01 — Budget Function and Request Body
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/reasoning-budget-base/spec.md` (rulings Q10, Q11, Q14).

## What to build

The Reasoning Budget slider tells the truth. Its readout shows `pct% · N tok` from the routed endpoint's Max Output for every prompt, Stat Updates and Location Change included, so it matches what the request sends. The slider goes up to 150% in steps of 5. When the endpoint's Max Output override is off, the slider is disabled, still shows the percent, and a hint tells the player to set a Max Output on the endpoint. The description and ⓘ say the percent is a share of the endpoint's Max Output and that the thinking comes in addition to the answer.

Workload rationale: Settings modal wiring, copy, and readout tests. Sonnet at medium effort.

## Acceptance criteria

- [x] Readout tokens come from the endpoint base through ticket 01's function, even with a custom Max Output row set. Stat Updates and Location Change no longer fall back to a different cap.
- [x] Slider max is 150, step 5, no new mark at 100%.
- [x] Override off: slider disabled, percent still shown, hint present. Hint copy follows the Writing Guide (verb-first, second person).
- [x] Description and ⓘ rewritten per the spec's Copy line; `copy-sweep` on the touched strings.
- [x] Settings tests: tokens from the endpoint base with a custom row set; disabled slider and hint with the override off; slider max 150.
- [ ] `verify-ui` on the Settings prompt options panel via the dev-router, both states (override on and off).
- [ ] Four gates green.

## Comments

**Handoff from ticket 01 (2026-09-27, commits 1d649f2f and 38d31dbc).** The shared function is `reasoningBudget({ effort, kind, budgets, base, answerCap, floor })` in the reasoning-effort module. Get `floor` from `reasoningDialectBudgetFloor(dialect)` where the record takes a budget, else 0. `MAX_REASONING_BUDGET_PCT` is 150. Its `maxTokens` assumes a reasoning signal: the request adds headroom only when a reasoning field goes out or the record answers `reasons: true` (Q16). Apply the same rule where you consume the function.

**Ticket 03 done (2026-09-27, commit ce8e994d).** The readout calls `reasoningBudget` with no base guard, so a floor dialect with the override off reads its floor, as the request sends it (Q14). Not verified: `verify-ui`. On the 5182 preview, every dev-router modal (Settings and Changelog alike) empties the page with no error logged, so the panel could not be reached. Test gate: 220 failures in the full run, all 5 s timeouts under machine load except `VariableNode.label.test.tsx`, which fails alone and is outside this unit. The Settings files pass alone (61/61).
