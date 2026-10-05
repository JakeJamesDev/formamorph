# 04: Template Editor Mode

Status: ready-for-agent
Blocked by: 02 — Drill Menu in the Stat Box
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), decisions 1 and 3, ruling Q6.

## What to build

The Code Templates editor's Variable button opens the same drill menu in template mode. Every name level is one row that inserts a selected `Name` to type over, so the path reads `stats["Name"].value` with `Name` selected. Groups, fields, Back, keyboard and tooltips behave as in the stat box. The Slot menu is unchanged.

Workload: wiring an existing component with one mode flag and its tests. A mid-tier model at medium effort.

## Acceptance criteria

- [ ] In the template editor, Variable → Stats shows one `Name` row; picking value inserts `stats["Name"].value` with `Name` selected
- [ ] Variable → Entities → Name → Traits → Name → enabled inserts the full bracket path with the first `Name` selected
- [ ] This Stat and Clock insert as in the stat box
- [ ] The Slot menu is unchanged
- [ ] Changelog: fold into ticket 02's entry
