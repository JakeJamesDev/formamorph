# 04: Item and Tool Script Images

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Item scripts and a world Tool's On Call script can call `player.show`. The image goes above or below the narration depending on when the script ran. Tells from item scripts survive a save load. The spec covers this in Q8 and Q16.

- **Placement.** A run before the narration starts places its images above. A run after the reply ends, or between turns, places them below the latest turn. Item scripts run at reply end, so their images go below. Extend ticket 01's placement grouping. Do not build a second one.
- **Restore.** Restore accepts the item timings for text and image entries. Today it drops item-timed tells on load.
- **Docs.** Note item and Tool placement in [Scripts-Reference.md](docs/Scripts-Reference.md). Write a changelog fragment that also covers the restored item tells.

## Acceptance criteria

- [ ] An item script's `player.show` renders its image below the turn's narration.
- [ ] A world Tool's On Call `player.show` during a turn, before the narration starts, renders above. Between turns, it renders below the latest turn.
- [ ] A save with an item-timed tell and an item-timed image reloads with both in place. A test fails when the item timings are removed from the restore filter.
