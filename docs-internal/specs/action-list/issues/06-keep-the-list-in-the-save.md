# 06: Keep the List in the Save

Status: done
Blocked by: 01, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

A save shape change; snapshots can be large, so the round trip needs care.

## What to build

A player acts in the panels, saves or closes the game, and reloads. The Action List comes back with the same entries, hidden flags and counts, and undo still restores. The live list and its snapshots are a new save field. A save without the field loads with an empty list. There is no compat code for unreleased forms.

Spec rulings: Q12.

## Acceptance criteria

- [x] A save with a live list reloads with the same entries, and undo of the newest restores the pre-action state; a round-trip test covers it. `GameViewer.actionList.test.tsx` "reloads the entries, hidden flags and counts, and undo still restores".
- [x] A save without the field loads with an empty list. `GameplayContext.actionList.test.tsx` "writes no field for an empty list…"; a malformed entry also loads empty (Q49).
- [x] Autosave and manual save both carry the list. Both go through writeSave (Q47); "writes the list in an autosave too".
- [x] The response names the save shape change (export-shape reminder). New `actionList` field; saved snapshot states carry no `fullMessageHistory` (Q48).

## Landed

**Not verified**
- None.

**For you**
- Use an item, hide a row, save, load the save: the Since Last Turn tray shows the same rows, and Undo works (In Game).
