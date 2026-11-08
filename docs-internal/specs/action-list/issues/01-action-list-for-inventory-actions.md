# 01: Action List for Inventory Actions

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Sets the shapes every later ticket builds on: the pure list module, the Listed Action type, the per-entry snapshot, and the tray.

## What to build

A player uses a potion, equips a sword, gives, drops or picks up an item from the Inventory tab. Each action adds a Listed Action to the Action List, a tray above the action box. The tray counts what the AI will be told and what is hidden, and expands and collapses with an animation. Each row shows the Inventory tab's icon, the entry line, a hide toggle, and an undo on the newest row only. Undo restores the game exactly as it was before the action, script writes and item effects included. Unequipping right after equipping, or picking up right after dropping the same copy, undoes the newest entry instead of adding one. Repeats of the same action, item and target collapse into one row with a count, and undo removes one repeat.

Nothing reaches the AI yet (ticket 02). The list lives in memory only (ticket 06).

Spec rulings: Q2, Q5 (inventory part), Q6, Q16, Q17 (inventory reversals), Q18, Q24–Q27. The spec's Implementation Decisions hold the prototype's reversal and collapse rules.

## Acceptance criteria

- [x] The pure Action List module adds, collapses, treats an exact reversal of the newest entry as its undo, undoes one repeat, toggles hidden, closes, and writes each entry's line. Its tests cover each rule, a run broken by a different action, and a reversal that is not the newest (no undo). (`src/lib/actionList.test.ts`, 16 tests)
- [x] Use, equip, unequip, give, drop and pick up from the Inventory tab each add an entry, after the action runs as it does today. (`useInventoryPanel.actionList.test.tsx`)
- [x] Undo restores the snapshot taken before the action: the item copies, item effects, trait state and any stat a used item's script wrote all return. A test proves a script's write reverts. (`GameViewer.actionList.test.tsx` "undoes a use"; fails with the restore removed)
- [x] Unequip right after equip of the same copy leaves no entry and does not run the unequip scripts. (`GameViewer.actionList.test.tsx`; fails with the reversal removed)
- [x] The tray shows only when the list has entries; its header counts shown and hidden entries; its chevron points right when collapsed and down when expanded; expand and collapse animate. (DOM test reads `aria-expanded`, `rotate-90` and the `grid-template-rows` transition; motion itself not watched)
- [x] Each row's icon is the Inventory tab's icon. (test reads `lucide-package` on each row; the tab uses `ItemIcon`)
- [x] **Action List** and **Listed Action** are in `CONTEXT.md`.
- [x] Tray copy is written under the Writing Guide. (labels Title Case: Since Last Turn, Only You, Undo One; tooltips verb-first)
- [x] Frames: `.scratch/frames/tray-expanded.png` and `.scratch/frames/tray-collapsed.png`, light and dark, at 1440 px wide. (Playwright; dark ones end in `-dark`)

For you: the tray's expand and collapse motion, in a game with three or more entries.

## Landed

Rulings Q28–Q31 came from the spec session for this ticket. Beyond the list above:

- Undo keeps the notes, the character and the page's narration text live (Q29). A test proves notes and narration survive.
- A panel action and the tray wait while the previous action's item scripts still run, so a snapshot never misses a script write.
- Sending, rollback and regenerate clear the live list. Ticket 02 stores the sent list; ticket 07 reopens it on regenerate.
- The header counts rows: a ×3 row counts once.

**Not verified**

- The expand and collapse motion itself; only its end states and transition property are checked.

**For you**

- The tray's expand and collapse motion, in a game with three or more entries: `#dev?view=gameViewer&fixture=items&tab=inventory`, use and equip a few items, then click **Since Last Turn**.
- Until tickets 04 and 05 land, a trait toggle, travel or stat edit made after a listed inventory action is not listed, and undoing that inventory entry reverts it too.
- Frames: `.scratch/action-list-01/frames/tray-expanded.png`, `tray-collapsed.png`, `tray-expanded-dark.png`, `tray-collapsed-dark.png`.
