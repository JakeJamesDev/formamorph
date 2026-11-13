# 05: In-Game World Options Tab

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player changes mid-game Options during play.

- A new tab, the rightmost of the in-game right panel, lists only Options flagged for mid-game change and Shown to Player. With none, the tab does not show (Q22, Q26).
- A change works like a player trait toggle (Q41): the tab is disabled while a turn runs; when idle the change applies at once, gates settle, and it becomes a Listed Action hidden from the narrator (Q42) that undo can reverse.
- 03 left two pieces for mid-game changes: Option pins aliased per history page, so earlier pages keep the text they were written under, and undo restoring Option values.
- A dev-router entry for the tab.
- Docs: the wiki's playing pages. Changelog fragment.

Spec rulings: Q14, Q22, Q26, Q41, Q42.

## Acceptance criteria

- [ ] A change made while idle reaches the next request's pins, and the tab is disabled while a turn runs.
- [ ] The change is a hidden Listed Action: undo restores the old value, and the narrator request never names it.
- [ ] The tab lists only mid-game, shown Options, and is absent when there are none.
- [ ] Frames: `.scratch/frames/options-game-tab.png`, light and dark, at 1280 px and 390 px.

For you: whether changing an Option mid-game feels clear (play a world with a mid-game Option).
