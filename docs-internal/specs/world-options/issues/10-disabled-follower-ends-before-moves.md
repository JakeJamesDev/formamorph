# 10: A Disabled Follower Stays Where It Was Disabled

Status: done
Blocked by: none
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An entity that turns off while it follows the player stays at the place where it turned off (Q9, Q38).

- `commitEntityMoves` moves followers with the player first and ends disabled entities' follows after. A follower that turned off since the last commit is carried one move. Example: a mid-game Option change (Q41) turns it off, and then the player moves.
- On re-enable, Q38 puts it back at its stored position. That position is now the player's new place, not the place where it turned off.
- Fix: end a disabled entity's follow before the commit's moves apply.
- An entity that turns off through this turn's own commit is outside this ticket unless the fix covers it without new state. If so, name it in Landed.

Spec rulings: Q9, Q38, Q41.

## Acceptance criteria

- [x] A `computeTurnCommit` test: a follower in `world.off` stays put when the player moves in that commit, and its follow ends. Red with the old order. Test "is not carried by the player's move in the commit that finds it off"; failed with the old order, passes now.
- [x] A re-enabled entity comes back at the place where it turned off. Test "is back at the place where it turned off once it is re-enabled".

## Landed

**Not verified**: none.

**For you**: nothing a player must judge. An entity that turns off through this turn's own commit is covered by the same fix, with no new state: the commit's `world.off` ends its follow before the moves apply.
