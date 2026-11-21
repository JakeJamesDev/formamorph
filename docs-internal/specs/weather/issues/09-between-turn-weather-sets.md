# 09: Between-Turn Weather Sets

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A weather set from a script that runs between turns takes effect. The spec covers this in the Scripts section: "A set lands at commit through the existing write path, saves with the turn and undoes with it."

- **Gap.** Item and switch scripts get `world.weather`, and the script reads its own set back. The between-turn landing (`landOnLatestTurn` in the game view) never applies `writes.weather`. The weather stays the same, nothing is saved and no effect plays.
- **Landing.** A between-turn set lands on the latest turn like the other world writes: the World Weather changes, the latest turn's snapshot records it, and the Weather Change helper reports it so the foreground can fire. The nightfall rule applies to the result.
- **During a turn.** A set from a run that ends while a turn runs is held and lands with that turn's commit, through the existing held-writes path.

## Acceptance criteria

- [ ] An item script that sets Storm between turns changes the World Weather, and the latest turn's snapshot records Storm.
- [ ] The set reports a Weather Change that may fire foreground.
- [ ] A set held while a turn runs lands with that turn.
- [ ] Bright Sun set at night ends as Clear.
- [ ] Each guard bites when its bug returns.
- [ ] Changelog: fold into the unreleased script weather entry if its text needs it.
