# 01: Budget range 50–200% and new defaults

Status: ready-for-human
Base: 46fb27f3
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Rationale: constant and default changes with known clamp and sanitizer paths; the test updates are the bulk.

Parent: [Answer Cap and Reasoning Room spec](../spec.md)

## What to build

The Reasoning Budget slider runs 50–200% in steps of 5. Narration ships at 150%, and every other prompt ships at 75%. A stored percent below 50 loads and sends as 50 through the existing clamp. A shared prompt preset keeps budget values up to 200 and clamps higher values to 200. No field changes shape, and there is no migration.

## Acceptance criteria

- [x] The slider's minimum is 50 and its maximum is 200.
- [x] A fresh narration prompt shows 150%, and a fresh Low-reasoning prompt shows 75%, with the token readout.
- [x] A stored 25% shows as 50% and sends the 50% budget.
- [x] A shared preset with 200% survives export and import; 250% imports as 200%.
- [x] Request-body tests show the new default budgets on a budget-taking target.
- [x] Changelog line in 🚧 In Progress.
- [x] Four gates green.
