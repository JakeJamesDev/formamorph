# 05: Keep On Call Shows Through Re-roll Stats

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

After Re-roll Stats, a turn keeps the images and tells that its world Tool On Call scripts made. Today they disappear. The spec covers this in Q7 and Q30.

- **The bug.** An On Call run, and an item script that a Tool call fires during the turn, record their entries with the `before` timing. Re-roll Stats drops every Start, Before and After entry and expects the replay to add them again. But the replay applies On Call writes as saved, with no script run, so nothing adds those entries back.
- **Scope.** The fix covers text tells and images alike. Text tells had the bug before this effort.
- **Save shape.** The fix must not lose entries in saves that already exist. If the fix tells On Call entries apart through a new field, that is an export-shape change and needs the reminder.
- **Docs.** If the re-roll rule changes, correct it in [Scripts-Reference.md](docs/Scripts-Reference.md). Write a changelog fragment.

## Acceptance criteria

- [x] A turn whose On Call script called `player.show` and `player.tell` still shows both after Re-roll Stats. A GameViewer test covers it, and it fails when the fix is reverted. (`GameViewer.scriptImagesSources.test.tsx`, "keeps an On Call Tool’s image and tell…"; red with the `call` prompts removed.)
- [x] An item script that a Tool call fires during the turn keeps its image and tell through Re-roll Stats. ("keeps the image and tell of an item script a Tool call fires…"; red with the replay's muted host removed, which doubled them.)
- [x] Before the AI script entries still drop and replay as Q7 says, and an abandoned re-roll still restores them. (Unchanged `GameViewer.scriptPrompts.test.tsx` re-roll and stopped-re-roll tests, green.)

## Landed

- **Export shape:** additive. Saved `scriptTells` entries can now hold `timing: 'call'` (Q33). Older saves restore unchanged; their `before`-tagged On Call entries still drop on a re-roll (Q33, no rescue). A 3.7.0 build drops `call` entries on load.
- **Q34–Q36:** re-roll now drops item-timed and `switch` entries and replays them. Tests cover the Inventory pass replace, the stopped-re-roll restore for items and switches, the switch replace, and a between-turns panel equip's entry dropping with the rollback. Each guard was mutation-tested red.
- **On Call replay:** laying the saved writes on still runs the switch and item scripts they set off. That replay records no tells, shows or toasts, and its asks still reach the player.

**Not verified**

- None.

**For you**

- Play a turn where a World Tool's On Call script calls `player.show`, then press Regenerate Stats. The image should stay above the narration, once.
