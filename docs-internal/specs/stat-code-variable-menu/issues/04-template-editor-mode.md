# 04: Template Editor Mode

Status: done
Blocked by: 02 — Drill Menu in the Stat Box
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), decisions 1 and 3, rulings Q6, Q17.

## What to build

The Code Templates editor's Variable button opens the same drill menu in template mode. Ticket 02 already picks template mode from the editor's slots flag (ruling Q17), so this ticket proves it: every name level is one row that inserts a selected `Name` to type over, so the path reads `stats["Name"].value` with `Name` selected. Groups, fields, Back, keyboard and tooltips behave as in the stat box. The Slot menu is unchanged. Fix whatever the tests find.

Workload: tests over an existing mode flag plus a visual check. A mid-tier model at medium effort.

## Acceptance criteria

- [ ] In the template editor, Variable → Stats shows one `Name` row; picking value inserts `stats["Name"].value` with `Name` selected
- [ ] Variable → Entities → Name → Traits → Name → enabled inserts the full bracket path with the first `Name` selected
- [ ] This Stat and Clock insert as in the stat box
- [ ] The Slot menu is unchanged
- [ ] Changelog: fold into ticket 02's entry
