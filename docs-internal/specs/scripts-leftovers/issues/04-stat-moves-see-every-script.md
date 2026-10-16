# 04: Stat Moves See Every Script

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: one reader switches to the shared list, with owner reach to keep right.

## What to build

The stat-move check reads every script from the shared list. A move that leaves a world script or a trait script reading a stat it no longer reaches is reported, as a stat script's read is today.

## Acceptance criteria

- [ ] Moving a stat away from an owner reports a world script that reads it.
- [ ] Moving a stat reports a trait script that reads it through the moved owner.
- [ ] A move that every script still reaches reports nothing.
- [ ] Guards fail when the reader goes back to stat scripts only.
