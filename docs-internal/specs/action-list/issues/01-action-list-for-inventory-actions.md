# 01: Action List for Inventory Actions

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Sets the shapes every later ticket builds on: the pure list module, the Listed Action type, the per-entry snapshot, and the tray.

## What to build

A player uses a potion, equips a sword, gives, drops or picks up an item from the Inventory tab. Each action adds a Listed Action to the Action List, a tray above the action box. The tray counts what the AI will be told and what is hidden, and expands and collapses with an animation. Each row shows the Inventory tab's icon, the entry line, a hide toggle, and an undo on the newest row only. Undo restores the game exactly as it was before the action, script writes and item effects included. Unequipping right after equipping, or picking up right after dropping the same copy, undoes the newest entry instead of adding one. Repeats of the same action, item and target collapse into one row with a count, and undo removes one repeat.

Nothing reaches the AI yet (ticket 02). The list lives in memory only (ticket 06).

Spec rulings: Q2, Q5 (inventory part), Q6, Q16, Q17 (inventory reversals), Q18, Q24–Q27. The spec's Implementation Decisions hold the prototype's reversal and collapse rules.

## Acceptance criteria

- [ ] The pure Action List module adds, collapses, treats an exact reversal of the newest entry as its undo, undoes one repeat, toggles hidden, closes, and writes each entry's line. Its tests cover each rule, a run broken by a different action, and a reversal that is not the newest (no undo).
- [ ] Use, equip, unequip, give, drop and pick up from the Inventory tab each add an entry, after the action runs as it does today.
- [ ] Undo restores the snapshot taken before the action: the item copies, item effects, trait state and any stat a used item's script wrote all return. A test proves a script's write reverts.
- [ ] Unequip right after equip of the same copy leaves no entry and does not run the unequip scripts.
- [ ] The tray shows only when the list has entries; its header counts shown and hidden entries; its chevron points right when collapsed and down when expanded; expand and collapse animate.
- [ ] Each row's icon is the Inventory tab's icon.
- [ ] **Action List** and **Listed Action** are in `CONTEXT.md`.
- [ ] Tray copy is written under the Writing Guide.
- [ ] Frames: `.scratch/frames/tray-expanded.png` and `.scratch/frames/tray-collapsed.png`, light and dark, at 1440 px wide.

For you: the tray's expand and collapse motion, in a game with three or more entries.
