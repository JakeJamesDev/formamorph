# 06: Choices Code Tidy-Up

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: six mechanical cleanups the close review named, each behavior-neutral and held by the effort's existing tests.

## What to build

The close review of this effort left six Standards findings, all judgement calls. Fold them in with no behavior change:

1. The game view's **Re-generate Choices** rerun rebuilds the start, before-box, On Call replay and After sequence that the stats re-roll already runs. Extract one "replay to the After batch" builder both use, each passing its landing mode.
2. The executor and the turn runner each check "did the choices list change" with their own length-and-every comparison. One shared `sameChoices` helper.
3. The executor's end-of-run choices read returns an `unknown` that secretly means "unchanged or a list", and the rerun returns a list, `undefined` or `null` with three meanings. Give each a small result shape that names its cases.
4. The empty reply `{ narration: '', choices: [] }` is spelled out six times across the samples, the executor, the Tool sample snapshot and the game view. One constant beside the empty turn.
5. The scan predicate reads as a noun. Rename it so a reader sees a yes-or-no question, and use the already imported owned-trait-states type where the game view re-derives it from a function's parameters.
6. The silent prompt host copies the answer-widening cast the two existing hosts carry. Name the cast once and call it from all three.

The tests that held each landing keep holding. No surface, copy or save change.

Spec: close review Standards findings, 2026-10-26.

## Acceptance criteria

- [x] The stats re-roll and the choices rerun share one replay builder (`replayToAfter`, up to the On Call replay); the re-roll and rerun tests run in prepare's gates
- [x] One choices-equality helper serves the executor and the turn runner, with its own test for same, reordered and edited lists (`sameChoices` in `scriptedChoices.test.ts`)
- [x] The end-of-run choices read and the rerun each return a named result shape (`ChoicesAtEnd`, `ChoicesRerun`); no `null`-versus-`undefined` meaning remains
- [x] The empty reply literal appears once (`EMPTY_REPLY`; test fixtures keep their own)
- [x] The scan predicate's name reads as a question at every call site (`scriptsChangeChoices`)
- [x] The prompt-answer widening cast is written once (`answerAs`)
- [ ] Every test file the effort landed passes unchanged in what it asserts (see Not verified)

## Blocked by

- None (can start immediately)

## Landed

**Not verified**

- Every effort test file passes unchanged: prepare's gates run the affected tests once; I ran only typecheck and lint before it.
- The After batch preparation (`prepareStatCode(..., 'after')`) stays in each caller: the re-roll lands it through `applyStatChanges`, the rerun runs it silent. The builder stops at the On Call replay.

**For you**

- Re-roll Stats and Re-generate Choices in a world with After the AI scripts that write `turn.choices`: both should behave as before.
