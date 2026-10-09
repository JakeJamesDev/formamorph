# 03: Whole-Selection Restore

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a contained change to what the Origin stores and how reveal applies the selection.

Parent: [History Reveal Origin spec](../spec.md)

## What to build

The Origin records the whole selection at the time of the edit. Reveal restores the records of it that still exist (Q5). If none exist, reveal falls back to today's target (Q4). This replaces undo-history Q35's keep-or-replace rule.

## Acceptance criteria

- [ ] An edit made with several records selected restores all of them on undo and redo.
- [ ] Gone records drop out of the restored selection.
- [ ] When every record is gone, reveal falls back to today's target.
- [ ] Canvas multi-selection restores the same way.
- [ ] Pure reveal tests for the partial and empty cases. Bench tests for a list and the canvas.
- [ ] The partial-selection test fails when gone records are kept.
