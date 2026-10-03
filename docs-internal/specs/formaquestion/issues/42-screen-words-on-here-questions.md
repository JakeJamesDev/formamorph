# 42: Screen words on "here" questions

Status: done
Base: 76d770c8
Blocked by: 38
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

"What does this window do?" asked over a dialog stops finding the Formaquestion window (Q69). Ticket 40 found that "window" pulls three Formaquestion sections into `here-backup-dialog`. Without them, all 10 answers describe the right dialog. In `here-memory-tab`, "panel" pulls in the World Editor panel sections.

- When the question has a Surface, the search ignores the screen words "window", "panel", "dialog", "screen" and "tab". It uses the filler mechanism of ticket 36.
- With no Surface, the words still match. "How do I move the help window?" finds the Formaquestion window section.

**Probe.** Run ticket 26's harness on the here and task kinds, default cloud model, 5 runs, with the current build as the in-batch control. Name `here-backup-dialog` and `here-memory-tab`.

Recommended model rationale: a word list scoped to one condition.

## Acceptance criteria

- [x] "What does this window do?" with the Backup & Restore surface sends no Formaquestion section; a test asserts it
- [x] "How do I move the help window?" with no surface still finds the Formaquestion window section; a test asserts it
- [x] Probe numbers, fixed vs current build, same batch, are in the handover
- [x] Four gates green

## Handover

Commit: "Screen Words in Help Questions Over a Screen". `search` takes `{ onSurface }`; `helpSections` sets it when a lead section exists. A Surface with no mapped section (unmapped or excluded) has no lead, so screen words still match there. Callers other than `helpSections` (lookup tool, Guide, Ask fallback) don't pass the option. A test with a bite check (guard off → red) covers both questions in `helpSession.filler.test.ts`. Gates green: typecheck, lint, test (965 files, 125 s), build.

**Probe.** `npm run probe:help -- --screen-old --kinds here,task --runs 5`, default cloud model, one batch (`testing/baseline/runs/help-baseline-2026-10-02T14-33-10-281Z.md`). `screen-old` is the current build, `retrieval` is the fix.

| Kind | Arm | Grounded-correct | Right source | Wrong, no flag |
|---|---|---|---|---|
| Here (60) | screen-old | 87% | 100% | 13% |
| Here (60) | fixed | 100% | 100% | 0% |
| Task (375) | screen-old | 55% | 59% | 33% |
| Task (375) | fixed | 55% | 59% | 33% |

- `here-backup-dialog`: the control sent `Formaquestion#the-window`, `how-to-open-formaquestion` and `how-to-move-and-resize-the-window`. The fix sent none.
- `here-memory-tab`: the control sent `World-Editor-Stats#the-panel` and `World-Editor-Traits#the-panel`. The fix sent none.
- Task questions have no Surface, so both arms match. The 4-point gap in Correct, other source is cloud drift.
