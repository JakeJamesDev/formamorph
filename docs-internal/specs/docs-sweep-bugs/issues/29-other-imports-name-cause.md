# 29: Other Imports Name the File and the Cause

Status: ready-for-agent
Blocked by: 28
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: moves four kinds onto the report ticket 28 builds.

## What to build

Dictionary, entity card, save and player avatar imports hide their causes the same way as worlds. A wrong file on the entity import reads "Couldn't import 1 entity.", and the written text, such as the line that points a world file to the Worlds tab, never shows. Ruling Q23 applies to all four. Ruling Q24: a player who declines a duplicate avatar made a choice, so that file doesn't count as skipped.

Spec: Q23, Q24. Evidence: the error audit after this spec's close.

## Acceptance criteria

- [ ] A test per kind with one bad file fails today (no cause), then passes with the file name and the cause
- [ ] A world file on the entity import shows the written line that points to the Worlds tab (test)
- [ ] Declining a duplicate avatar counts as neither imported nor skipped (test)
- [ ] A lorebook that fails on a stored card keeps today's result (test)
- [ ] The new copy follows the Writing Guide; the copy sweep ran on it
- [ ] A changelog fragment under Minor / Fixed / 👤
