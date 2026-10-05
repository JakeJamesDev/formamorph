# 05: Guide Paragraph and Changelog Fold

Status: ready-for-human
Blocked by: 02 — Drill Menu in the Stat Box
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), decision 4, ruling Q16.

## What to build

The Stat Code Guide gains one paragraph under its editor section: the Variable menu's top level, that a group opens the world's own names, and that a field inserts a path that runs as written. Voice per the Writing Guide. The help index picks the paragraph up so the help window can answer "how do I reference an entity's trait" from it.

The changelog line added on 2026-10-05 for the flat eleven-row list is folded into this feature's entry under Stat Code, so one change reads as one entry.

Workload: prose and a changelog edit. A mid-tier model at medium effort.

## Acceptance criteria

- [ ] The guide's editor section has the paragraph; copy follows the Writing Guide
- [ ] The help retrieval test for "reference an entity's trait in stat code" returns the section
- [ ] The 2026-10-05 flat-list changelog line is gone; the feature entry states the drill menu alone
- [ ] Changelog: the folded entry under Added, 👤 User-facing, Stat Code
