# 07: Entity Code Writes

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A small, well-bounded addition to the stat code surface.

## What to build

A script can place any entity, make it follow the player, or send it away: `entities["Name"].move(target)`, `.follow()` and `.unfollow()`. Schedules and conditions (a wight that leaves its tomb, a nightly raid) live in scripts this way.

## Acceptance criteria

- [ ] `move(target)` resolves the target by id, then by name; an unknown target throws a clear error.
- [ ] `follow()` adds the entity to the followers and moves it to the player's location. `unfollow()` removes it and leaves it where the player is.
- [ ] Any write on a Free entity starts tracking it.
- [ ] Code entity writes apply last in the commit.
- [ ] The surface lists the three writes with completion info, and the Stat Code Guide documents them in the technical register.
- [ ] Executor tests cover lookup, the throw, tracking a Free entity and commit order.
