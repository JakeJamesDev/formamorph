# 05: List Stat Edits

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

One action kind on an existing commit path; the module and tray already exist.

## What to build

A manual edit of a global or entity stat adds a Listed Action that arrives hidden, with the Stats tab's icon. Its line carries the old and new value ("Health 40 → 60"). The player can show it so the narrator hears it. Undo restores the value and the page snapshot the edit patched.

Spec rulings: Q1, Q20, Q27.

## Acceptance criteria

- [x] A global stat edit and an entity stat edit each add a hidden entry with the Stats tab icon. (`GameViewer.actionList.test.tsx`: lists a global stat edit hidden…, lists an entity stat edit…)
- [x] The entry line carries the old and new value. ("Calm 50 → 70", "Ash’s Nerve 50 → 65")
- [x] Showing the entry makes it count as told to the AI in the tray header. (header reads "1 for the AI" after Tell the AI)
- [x] Undo restores the old value, in live state and in the page snapshot. (merge-drag and entity undo tests read `gameStates[0]`; failed with the page revert removed)

## Landed

**Not verified**
- Entry text reaching the narrator: no prompt change in this ticket, so a shown stat entry is only counted in the tray.
- The tray and the locked fields in a real browser: jsdom tests only.

**For you**
- Stats tab, Edit Stats on: drag a slider and check the tray holds one "Stat A → B" row, hidden, with the Stats icon.
- Start a turn and check the sliders and number fields lock until it ends.
