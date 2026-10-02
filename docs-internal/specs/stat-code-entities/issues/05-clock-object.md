# 05: Clock object

Status: done
Base: 3c0c1e28
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Stat Code Entities spec](../spec.md)

## What to build

The story clock as one read-only `clock` object: `clock.day`, `clock.daypart`, `clock.deltaHours`, `clock.elapsedHours`, and `clock.previous.day` and `clock.previous.daypart` for the turn's start (Q15). This is the expand step: the flat clock globals stay until ticket 06.

## Acceptance criteria

- [ ] `clock` reads the same values the flat globals read today, in both code boxes.
- [ ] Every `clock` field is read-only. A write is dropped.
- [ ] The surface module, completions and help describe `clock`. The flat globals leave the documented surface but are still injected.
- [ ] Tests at `runStatCodeTurn`, each shown to bite. The changelog line is in In Progress.
