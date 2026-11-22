# 08: Bench Opening Picker on Every Reader

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Test Bench's Triggers and AI Context instruments read the shared Opening pick: their play state comes from `lensWorld` with `benchOpening`. Their lens bars hide the picker (`opening: false` in `src/lib/testBench/benchTabs.ts`), so an Opening-gated trait changes with a pick the author can't see. Show the picker on every instrument that reads the pick. The Opening instrument keeps its own pool pick (Q22).

Found by the close review.

## Acceptance criteria

- [ ] Triggers and AI Context show the Opening picker in their lens bars.
- [ ] A pick there changes an Opening-gated trait's state in that instrument.
- [ ] The Opening instrument's lens bar shows no shared Opening picker, and its draw ignores the shared pick.
