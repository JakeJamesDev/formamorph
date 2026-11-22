# 09: Code Card Opening Names

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The spec says an Opening Condition's line text reads the picked names or derived labels. Code cards build their gate without the world's Openings (`src/lib/codeWorldLookup.ts`, `editorGateInput`), so a trait's `requires` line reads "Opening" or "Opening (2)". Pass the Openings in, so code cards name them as the editor does.

Found by the close review.

## Acceptance criteria

- [x] A code card for a trait gated on a named Opening reads that name in its `requires` line. (`codeCards.opening.test.ts`, "reads the picked Opening’s name")
- [x] An unnamed Opening reads its derived label (Q24). (same file, "derived label")
- [x] A Not Condition reads the negated form. (same file, "negated form")

## Landed

**Not verified**: none. The test fails without the change ("Opening" and "not Opening" received).

**For you**: none.
