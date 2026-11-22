# 09: Code Card Opening Names

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The spec says an Opening Condition's line text reads the picked names or derived labels. Code cards build their gate without the world's Openings (`src/lib/codeWorldLookup.ts`, `editorGateInput`), so a trait's `requires` line reads "Opening" or "Opening (2)". Pass the Openings in, so code cards name them as the editor does.

Found by the close review.

## Acceptance criteria

- [ ] A code card for a trait gated on a named Opening reads that name in its `requires` line.
- [ ] An unnamed Opening reads its derived label (Q24).
- [ ] A Not Condition reads the negated form.
