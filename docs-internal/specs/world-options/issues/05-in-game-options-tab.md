# 05: In-Game World Options Tab

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player changes mid-game Options during play.

- A new tab, the rightmost of the in-game right panel, lists only Options flagged for mid-game change and Shown to Player. With none, the tab does not show (Q22, Q26).
- A change applies at the next turn commit, not mid-turn.
- A dev-router entry for the tab.
- Docs: the wiki's playing pages. Changelog fragment.

Spec rulings: Q14, Q22, Q26.

## Acceptance criteria

- [ ] A `computeTurnCommit` test shows a mid-game change taking effect at the next commit and not before.
- [ ] The tab lists only mid-game, shown Options, and is absent when there are none.
- [ ] Frames: `.scratch/frames/options-game-tab.png`, light and dark, at 1280 px and 390 px.

For you: whether changing an Option mid-game feels clear (play a world with a mid-game Option).
