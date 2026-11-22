# 10: One Derived Label Count

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An unnamed Opening's label is "Owner · Opening N" (Q2). The Openings tab counts N among the rows it shows (`src/managers/OpeningsPanel.tsx`, index from `src/lib/openings.ts`). The Condition and Bench pickers count every row (`src/lib/testBench/openingPick.ts`). With a hidden Self row ahead, one row reads "Opening 2" in the tab and "Opening 3" in a picker. Count every row, hidden Self rows included, everywhere (Q24).

Found by the close review.

## Acceptance criteria

- [ ] With a hidden Self row ahead of it, an unnamed Opening shows the same label in the Openings tab, the Condition picker and the Bench picker.
- [ ] The label stays the same when the shown set changes.
