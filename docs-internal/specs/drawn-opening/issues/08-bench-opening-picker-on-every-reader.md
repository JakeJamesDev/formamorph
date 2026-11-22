# 08: Bench Opening Picker on Every Reader

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Test Bench's Triggers and AI Context instruments read the shared Opening pick: their play state comes from `lensWorld` with `benchOpening`. Their lens bars hide the picker (`opening: false` in `src/lib/testBench/benchTabs.ts`), so an Opening-gated trait changes with a pick the author can't see. Show the picker on every instrument that reads the pick. The Opening instrument keeps its own pool pick (Q22).

Found by the close review.

## Acceptance criteria

- [x] Triggers and AI Context show the Opening picker in their lens bars. (`benchTabs.test.ts` flags; the bar draws from those flags)
- [x] A pick there changes an Opening-gated trait's state in that instrument. (these instruments already read `lensWorld`; `openingCondition.test.ts` covers the gate)
- [x] The Opening instrument's lens bar shows no shared Opening picker, and its draw ignores the shared pick. (flag test; `useTestBench` builds the Opening lens and play from `benchWorld`, pinned by `personaReaders.test.ts`)

## Landed

**Not verified**
- The Opening instrument ignoring the shared pick has only a source-pattern guard (`personaReaders.test.ts`), no behavior test: the wiring lives in the `useTestBench` hook.
- No Browser pane check of the picker on the two tabs.

**For you**
- In the Test Bench, open Triggers and AI Context: the Opening picker sits in the lens bar, and picking an Opening flips an Opening-gated trait.
- Open the Opening tab: no shared picker, and changing the pick elsewhere does not change its draw.
