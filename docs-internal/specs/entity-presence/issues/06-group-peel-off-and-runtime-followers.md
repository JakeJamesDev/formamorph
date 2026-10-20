# 06: Group Peel-Off and Runtime Followers

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Touches runtime characters, which already carry their own location.

## What to build

When an Everywhere Listed entity with Can Follow answers "come along", a new runtime character with its name joins the followers, and the original stays at every listed location. It peels one follower at a time. Characters invented in play can follow too.

## Acceptance criteria

- [ ] "Come along" from an Everywhere Listed entity creates a runtime character with its name and summary, already following, at the player's new location. The original doesn't move.
- [ ] While one of its runtime characters is following, the Everywhere Listed entity gets no request. Once that follower stays behind, it can be offered "come along" again.
- [ ] Runtime characters get Can Follow. A runtime character's existing `locationId` is its position.
- [ ] The Can Follow help line for an Everywhere Listed entity matches the spec's copy table.
- [ ] Turn-commit tests cover peel-off, the one-at-a-time rule and a runtime character following.
