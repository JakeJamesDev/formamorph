# 05: In-Game World Options Tab

Status: ready-for-human
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

- [x] A change made while idle reaches the next request's pins, and the tab is disabled while a turn runs. `GameViewer.worldOptions.test.tsx`: a pinned chip resolves `lush` after the pick; the radios disable while waiting. Not driven through a real request body.
- [x] The change is a hidden Listed Action: undo restores the old value, and the narrator request never names it. `GameViewer.worldOptions.test.tsx` (hidden row, undo) and `actionList.test.ts` (`toldActions` skips an unhidden Option entry); guards bite with the filter and the hidden flag removed.
- [x] The tab lists only mid-game, shown Options, and is absent when there are none. `GameViewer.worldOptions.test.tsx`.
- [x] Frames: `.scratch/frames/options-game-tab.png`, light and dark, at 1280 px and 390 px. Dark copies end in `-dark`; the 390 px pair ends in `-390` and `-390-dark`. The pane stores them at 800 px and 351 px.

For you: whether changing an Option mid-game feels clear (play a world with a mid-game Option).

## Landed

**Not verified**
- Gates settle (Q41): `changeWorldOption` writes the value and lists the action. It runs no trait or item settle, because no gate reads an Option until ticket 04's Condition lands. 04 must call the settle on a player change.
- No test drives a re-roll or a turn undo across a changed Option. They restore through the existing snapshot path (`loadGameState` carries `worldOptionValues`); checked by reading.
- No request body was read; the pin test resolves a chip through the view resolver.

**For you**
- Whether changing an Option mid-game feels clear (play a world with a mid-game Option, `#dev?view=gameViewer&fixture=options&tab=options`). Frames: `.scratch/world-options-05/frames/options-game-tab.png`, `options-game-tab-dark.png`, `options-game-tab-390.png`, `options-game-tab-390-dark.png`.
- A slider reports once on release, so one drag makes one entry.
- An Option entry has no **Tell the AI** switch: the AI never hears an Option change.
