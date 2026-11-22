# 10: One Derived Label Count

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An unnamed Opening's label is "Owner · Opening N" (Q2). The Openings tab counts N among the rows it shows (`src/managers/OpeningsPanel.tsx`, index from `src/lib/openings.ts`). The Condition and Bench pickers count every row (`src/lib/testBench/openingPick.ts`). With a hidden Self row ahead, one row reads "Opening 2" in the tab and "Opening 3" in a picker. Count every row, hidden Self rows included, everywhere (Q24).

Found by the close review.

## Acceptance criteria

- [x] With a hidden Self row ahead of it, an unnamed Opening shows the same label in the Openings tab, the Condition picker and the Bench picker. Test: `openingPick.test.ts` "numbers an unnamed row as the Openings tab does". The Condition and Bench pickers share `openingPickGroups`.
- [x] The label stays the same when the shown set changes. Test: `openings.test.ts` "the number in an unnamed row's label".

## Landed

**Not verified**
- The Openings tab was not viewed in a browser. The tab's label reads the row index the tests check.

**For you**
- None.
