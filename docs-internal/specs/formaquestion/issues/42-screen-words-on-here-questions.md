# 42: Screen words on "here" questions

Status: ready-for-agent
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

- [ ] "What does this window do?" with the Backup & Restore surface sends no Formaquestion section; a test asserts it
- [ ] "How do I move the help window?" with no surface still finds the Formaquestion window section; a test asserts it
- [ ] Probe numbers, fixed vs current build, same batch, are in the handover
- [ ] Four gates green
