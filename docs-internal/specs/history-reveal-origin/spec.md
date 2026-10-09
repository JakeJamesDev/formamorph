# History Reveal Origin

Status: ready-for-agent
Spec session: history-reveal-origin — spec
Status note: Supersedes undo-history ruling Q6 and replaces Q35's selection rule. Rulings Q1–Q11 settled in the grill on 2026-10-09.

## Problem Statement

After an undo or redo, the World Editor moves to the record the Step touched. It picks the place from the record's kind: an entity opens the Entities tab, a location opens the Locations tab. It does not look at where the author made the edit.

Several surfaces write records that another tab owns. An author edits a location's roster, the Opening on the Overview tab, an entity-owned trait on the Traits tab, or a placeholder chip inside a prompt. Then they press Ctrl+Z, and the editor jumps to a tab they never used. They lose their place, and they must find their way back to see what changed.

The reveal also stops at the record. The author must still find the field that changed.

## Solution

Each Step records the **Origin**: the place the author made the edit. That place is the tab, the selection, the sub-view and the field. Undo, redo and a jump return the author there. The editor then scrolls to the field and plays the Landing Pulse on it, so the author sees what changed. Keyboard focus stays where it is.

When the Origin can't be shown, the editor reveals the touched record on its own tab, as it does today.

## User Stories

### Back to where I edited

1. As an author, I want an undo of a roster edit to return me to the Locations tab with that location selected, so that I see the roster I changed.
2. As an author, I want an undo of an Opening edit to return me to the Overview tab's Opening sub-tab, so that I land where I made the change.
3. As an author, I want an undo of an entity-owned trait or Link edit made on the Traits tab to return me to the Traits tab, so that I don't land on the Entities tab.
4. As an author, I want an undo of an entity-scoped or book-scoped placeholder edit made on the Placeholders tab to return me to the Placeholders tab, so that I stay with the placeholder.
5. As an author, I want an undo of a pin edit on the Placeholders tab to return me to the Placeholders tab, so that I don't land on the pinned trait, entity, location or stat.
6. As an author, I want an undo of an inline chip edit to return me to the field that holds the chip, so that I see the prompt I was writing.
7. As an author, I want an undo of the rename offer's Apply to return me to the tab where I accepted it, so that I don't land on the Stats tab.
8. As an author, I want a redo to return me to the same place as the matching undo, so that undo and redo stay predictable.
9. As an author, I want a jump in the History Popover to return me to the Origin of the Step nearest the new cursor position, so that a jump behaves like the presses it replaces.
10. As an author, I want an edit made on a record's own tab to reveal as it does now, so that nothing changes where no mirror is involved.

### The changed field

11. As an author, I want the editor to scroll to the field I edited and pulse it, so that I see what the undo changed.
12. As an author, I want the pulse on switches, sliders, selects and color pickers too, so that non-text edits get the same feedback.
13. As an author, I want the pulse to play even when I'm already looking at the field, so that every undo shows its effect.
14. As an author, I want the pulse to restart on each press while I hold Ctrl+Z, so that each step is visible.
15. As an author, I want keyboard focus to stay where it is after a reveal, so that my next Ctrl+Z keeps stepping through the world history and doesn't undo inside a text field.
16. As an author using reduced motion, I want the still ring instead of the moving pulse, so that the reveal respects my setting.
17. As an author, I want the Landing Pulse used here to match the one Morphie uses, so that one mark means "look here" across the app.

### Selection

18. As an author, I want an undo to restore the whole selection I had when I made the edit, so that a multi-record edit returns to all of its records.
19. As an author, I want records that no longer exist to drop out of a restored selection, so that the selection only holds real records.
20. As an author, I want an undo to select the record I edited through a mirror, so that the selection matches what the edit touched on that surface.
21. As a mobile author, I want an undo of an edit made in the Locations canvas view to push the location's detail panel, as a tap does, so that Q34 still holds.

### When the Origin can't be shown

22. As an author, I want an undo to reveal the touched record on its own tab when every record of the Origin selection is gone, so that I still see the change.
23. As an author, I want an undo to reveal the touched record on its own tab when the editor mode hides the Origin tab, so that a mode switch doesn't hide the change.
24. As an author, I want an undo to reveal nothing when both the Origin tab and the record's own tab are hidden, so that the editor doesn't open a tab the mode hides.
25. As an author, I want a Step with no Origin, such as Optimize Images, to reveal as it does today, so that batch edits still show something.
26. As an author, I want a reveal to stop at the tab, selection and sub-view without a pulse when the field is no longer on screen, so that a removed row doesn't break the reveal.

### Steps follow the place

27. As an author, I want an edit from a different place to start a new Step, even within the typing pause, so that each Step has one Origin.
28. As an author, I want a change of field, sub-view, selection or tab to count as a different place, so that one Step never spans two fields.
29. As an author, I want typing in one field to keep merging into one Step, as it does now, so that the History Popover doesn't fill with keystrokes.

### Unchanged behavior

30. As an author in the Authoring Tour, I want the tour to keep control of the tab and selection, so that Q21 still holds and reveal stays off.
31. As an author, I want the History Popover's rows and labels unchanged, so that this change only affects where the editor lands.
32. As an author, I want a connection undo made on the canvas to select the connection on the canvas, so that the existing connection reveal still works.
33. As an author, I want canvas drags to reveal the dragged record without a field pulse, so that a drag still lands on the canvas.

## Implementation Decisions

### Rulings

| # | Ruling |
|---|---|
| Q1 | This is a new effort. It supersedes undo-history Q6. The closed spec gets only a one-line pointer next to Q6. |
| Q2 | A Step records its Origin: the tab, the whole selection, the sub-view (sub-tab, Locations list or canvas) and the field. It records the Origin at the Step's first write. |
| Q3 | Undo, redo and jumps reveal the Origin. A jump uses the Step nearest the new cursor position, falling back inward. |
| Q4 | When the Origin can't be shown, reveal falls back to today's behavior: the touched record on its own tab, or nothing if that tab is hidden too. This covers a fully deleted selection, a tab the mode hides, and a Step with no Origin (Optimize Images, dev hooks). |
| Q5 | Some selected records may be gone. Reveal selects the ones that still exist. If none exist, it falls back as in Q4. This replaces Q35's keep-or-replace rule. |
| Q6 | Every edit records its field, including chip edits inside a host field and non-text controls (switches, sliders, selects, color pickers). Canvas drags record no field. |
| Q7 | Reveal scrolls to the field and plays the Landing Pulse on it. It never takes keyboard focus. |
| Q8 | If the field can't be found, reveal stops at the tab, selection and sub-view with no pulse. |
| Q9 | The pulse plays on every undo and redo, even when the author is already on the field, and restarts on each key repeat. |
| Q10 | A write from a different place starts a new Step. Any difference counts: tab, selection, sub-view or field. |
| Q11 | Q34 applies to the Origin. A location in the canvas view pushes its detail panel on mobile. |

Undo-history Q21 (tour) stands. The History Popover is unchanged.

### Mirror surfaces

These surfaces write records that another tab owns. Today each one reveals on the owner's tab.

| Surface | Writes | Reveals today |
|---|---|---|
| Locations roster | entities | Entities |
| Overview, Opening sub-tab | entities, locations | Entities or Locations |
| Traits tab, entity-owned traits and Links | entities | Entities |
| Placeholders tab, entity-scoped or book-scoped placeholders | entities, dictionaries | Entities or Dictionary |
| Placeholders tab, pins section | traits, entities, locations, stats | the pinned record's tab |
| Inline chip in any prompt field | placeholders, or the pinned source | Placeholders or the source's tab |
| Rename offer, Apply | stats | Stats |

### The Origin

- The World Editor publishes the current place: the active tab, the selection, the sub-view and the field in use. It publishes through a ref that the world recorder reads. The recorder sits above the editor in the tree, so the editor fills the ref and the recorder only reads it.
- The recorder reads the place when a write opens a new Step. Merged writes keep the first Origin.
- A write commits in a layout effect, after child effects run. A tab switch in the same commit as a write would read the new tab. The editor's publish must be ordered so that the recorder reads the place as it stood when the write happened.
- The field in use comes from the control that holds focus or that the author is working. Fields carry a stable field identity in the DOM. The find bar's text matching is not reused, because a reveal runs after the text changed.
- A chip edit knows only its placeholder, not its host. The Origin field is the host field that holds focus, which covers chips without a new prop chain.
- The Origin is not part of the world and never enters a save or an export.

### History module

- A Step gains an optional Origin.
- The merge rule gains one condition: two writes merge only when their Origins match. Any difference in tab, selection, sub-view or field seals the Step (Q10). Writes without an Origin merge as they do now.

### Reveal

- The reveal function takes the Origin when there is one. It resolves to the Origin's tab, the surviving records of its selection, its sub-view and its field.
- It falls back to today's target when the Origin tab is hidden, when no selected record survives, or when the Step has no Origin.
- The reveal hook applies the target through the existing paths: the tab switch, the list selection, the sub-view switch, and the canvas's connection request. It then finds the field and calls the Landing Pulse on it. It never focuses the field.
- A field that isn't rendered ends the reveal at the selection (Q8).
- The tour guard is unchanged.

## Testing Decisions

A good test drives the seam an author would and asserts what the author would see: the active tab, the selected records, the sub-view, the pulsed element and the element that holds focus. Tests never read the Origin off a Step and never count recorder commits.

Three existing seams. No new seam:

1. **The rendered editor bench.** Edit on each mirror surface, move to another tab, undo, and assert the Origin tab, selection, sub-view and pulsed field. Also: focus stays put, the pulse restarts on repeat, the pulse plays when already in place, partial selection restore, Q34 on mobile, a no-Origin batch, a hidden Origin tab, and a missing field. Prior art: the history reveal and field history tests on the editor bench.
2. **The pure reveal function.** The fallback table: no Origin, hidden Origin tab, both tabs hidden, all selected records gone, some gone. Prior art: the existing reveal tests.
3. **The history module.** A write from a different Origin starts a new Step. A write from the same Origin merges within the pause. Writes without an Origin merge as before. Prior art: the merge-by-key tests.

Every guard proves it bites. The seal test fails when the Origin check is removed from the merge rule. The focus test fails when reveal focuses the field. A mirror test fails when reveal ignores the Origin.

## Out of Scope

- The History Popover's rows, labels and grouping.
- Reopening dialogs or popovers. Reveal lands on the surface under them.
- Undo inside a single text field (Lexical's own history).
- The Authoring Tour's reveal rule (Q21).
- In-game editing outside the World Editor.

## Further Notes

- The mirror list came from a code review of the write paths on 2026-10-09. A first pass named three mirrors that don't exist (the entity trait editor, TraitManager's stat fields, and the pins section's direction). The table above is the corrected list.
- The Landing Pulse already ends itself and has a reduced-motion ring, so this effort adds no new visual pattern.
