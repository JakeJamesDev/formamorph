# 01: Record and Reveal the Origin Tab

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: this ticket sets the Origin seam between the World Editor and the recorder, and it must solve the commit-timing order. Every later ticket reads through it.

Parent: [History Reveal Origin spec](../spec.md)

## What to build

An author edits a record through a mirror surface, moves elsewhere, and presses Ctrl+Z. The editor returns to the tab where they made the edit, with the edited surface's main record selected. Today it opens the tab that owns the touched record.

The World Editor publishes its current place. The recorder reads it when a write opens a new Step and stores it as the Step's Origin. Reveal uses the Origin first and falls back to today's target (Q4). This ticket covers the tab and the main record only. Sub-views, whole selections, fields and the seal come later.

## Acceptance criteria

- [ ] Each mirror in the spec's table reveals its own tab after undo and redo: Locations roster, Overview Opening, Traits tab entity-owned traits and Links, Placeholders tab scoped placeholders, Placeholders pins, inline chips, rename offer Apply.
- [ ] The selected record after reveal is the record the author worked on that surface.
- [ ] An edit made on a record's own tab reveals as before.
- [ ] A jump reveals the Origin of the Step nearest the new cursor position, falling back inward.
- [ ] Reveal falls back to today's target when the mode hides the Origin tab, when the Origin record is gone, and when the Step has no Origin (Optimize Images). Nothing is revealed when both tabs are hidden.
- [ ] A tab switch in the same commit as a write records the place as it stood at the write.
- [ ] The Origin never enters a save or an export.
- [ ] The tour guard (Q21) still holds.
- [ ] Tests on the rendered editor bench and the pure reveal function. The mirror test fails when reveal ignores the Origin.
