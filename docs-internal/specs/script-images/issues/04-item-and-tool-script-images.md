# 04: Item and Tool Script Images

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Item scripts and a world Tool's On Call script can call `player.show`. The image goes above or below the narration depending on when the script ran. Tells from item scripts survive a save load. The spec covers this in Q8 and Q16.

- **Placement.** A run before the narration starts places its images above. A run after the reply ends, or between turns, places them below the latest turn. Item scripts run at reply end, so their images go below. Extend ticket 01's placement grouping. Do not build a second one.
- **Restore.** Restore accepts the item timings for text and image entries. Today it drops item-timed tells on load.
- **Docs.** Note item and Tool placement in [Scripts-Reference.md](docs/Scripts-Reference.md). Write a changelog fragment that also covers the restored item tells.

## Acceptance criteria

- [x] An item script's `player.show` renders its image below the turn's narration. (`GameViewer.scriptImagesSources.test.tsx`, item gained at reply end)
- [x] A world Tool's On Call `player.show` during a turn, before the narration starts, renders above. Between turns, it renders below the latest turn. (During the turn: `GameViewer.scriptImagesSources.test.tsx`. Between turns: no gameplay path runs a Tool then; spec session ruled docs and test only.)
- [x] A save with an item-timed tell and an item-timed image reloads with both in place. A test fails when the item timings are removed from the restore filter.

## Landed

**Not verified**
- Between turns, a Tool image below the latest turn: no gameplay path runs a world Tool between turns. Try It and help Tools use silent prompts (spec Q30). No code or test for it.
- No frames: the placement is covered by DOM-order tests, not a rendered check.

**Placement case (spec session's check):** the tool loop drops any content a Tool round streamed (`src/lib/aiRequest/toolLoop.ts`, `toolCalls` clears what showed), so the reply is the final round and an On Call run always precedes the reply text. Every On Call image stays above.

**Also found:** an item script fired by a Tool call during the turn records as Before, so its image shows above. Item events at reply end or between turns show below. Documented in Scripts-Reference.

**For you:** read the added lines under `player.show` in `docs/Scripts-Reference.md`.
