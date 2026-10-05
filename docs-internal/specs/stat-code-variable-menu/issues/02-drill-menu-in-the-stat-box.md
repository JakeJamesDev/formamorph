# 02: Drill Menu in the Stat Box

Status: ready-for-human
Blocked by: 01 — Tree Builder and Sandbox Guard
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Spec: [spec.md](../spec.md), decisions 2 and 3, rulings Q1, Q8, Q9, Q10, Q14, Q15.

## What to build

The Variable button in each stat code box opens a drill menu over the tree from ticket 01. The top level and every group and field level render as plain rows; a name level renders its rows as plain rows too, with the trail as muted text (ticket 03 makes it searchable). Every level below the top starts with a Back row. Levels enter with the existing drill slide, from the right going deeper and from the left going back. A field row shows its info text in a tooltip; its accessible name stays the field name. Picking a field inserts its text at the caret through the same insert path the Slot menu uses, with the same selection and one undo step, and closes the menu. Opening the menu always starts at the top. Keyboard: Up and Down move, Enter drills or inserts, Backspace and Left go back, Escape closes. An empty group shows its marker row, disabled.

The flat stat snippet list is removed; the surface's snippets field is empty for stat code. The Slot menu, completions and diagnostics are unchanged. The Tool script editor keeps its own list.

Workload: focus management and keyboard inside a Popover with changing levels, plus the undo and selection contract of the insert path. A top model at high effort.

## Acceptance criteria

- [ ] Variable → Stats → Health → value inserts `stats.Health.value` at the caret and closes the menu
- [ ] Variable → This Stat → value inserts `self.value`
- [ ] Back returns one level; the slide direction matches
- [ ] Reopening the menu starts at the top level
- [ ] Enter drills a group or name and inserts a field; Backspace and Left go back; Escape closes
- [ ] A field row's tooltip carries the surface info text
- [ ] An empty group shows its disabled marker row
- [ ] The insert is one undo step, separate from typing around it
- [ ] The flat stat snippet list is gone; the Tool editor's Variable list is unchanged
- [ ] Both themes checked at a realistic viewport via the dev-router; the drill rows follow the Traits + menu pattern
- [ ] Changelog fragment under Added, 👤 User-facing, grouped under Stat Code
