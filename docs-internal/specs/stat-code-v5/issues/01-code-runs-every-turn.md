# 01: Code Runs Every Turn

Status: ready-for-human
Status note: Done in 9e43ab6c. All eight acceptance criteria met. The schedule lives in GameViewer, which has no unit-test harness, so the e2e spec is the only guard; the two new cases there are mutation-proven.
Base: 300d3575
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

A removal with a small blast radius: two gates, one branch, one bench rule, and the tests that assert the old schedule. Sonnet at medium effort.

## What to build

Stat code runs on every turn. The gate on the AI's asks and the gate on clock variables go away, along with the clock-only run branch and the Test Bench rule that warned code runs only on AI-change turns. The clock-variable detector that fed the gate goes with it unless another surface reads it. Code runs on the opening turn, on a turn where the AI reports no stat change, and on a turn where the stat request is off or failed. Regen still ticks once per turn, tied to time passing, before code. The guide says code runs every turn.

Existing worlds change behavior on purpose: code that ran only on AI-change turns now runs every turn. No migration and no exemption for that.

## Acceptance criteria

- [x] A turn where the AI asks for no stat change runs code and applies its writes
- [x] The opening turn runs code after the opening narration
- [x] A turn with the stat request off runs code with `delta.ai` at zeros
- [x] The clock-only branch and both gates are gone; a stat with clock code runs on the same schedule as any other
- [x] The never-ticks bench rule is removed with its tests; the rule list has no gap
- [x] The e2e stat-code spec gains a case where a quiet turn moves a stat through code
- [x] The guide states that code runs every turn
- [x] Four gates green; graph updated

## Blocked by

- None (can start immediately)
