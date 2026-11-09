# 08: Linked Stat Binding Refresh

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A gap the close review found. One lookup in the load refresh misses linked stats.

## What to build

A binding the author changes reaches saves in progress (Q17), for stats an entity carries through a stat link too. Today the load refresh matches an entity's saved stats against the entity's own authored stats only. A stat the entity carries through a stat link has no match there, so it keeps its saved `morphBindings` and `colorBindings`.

- The refresh resolves each entity's authored stats the way play does: its own stats, plus its linked stats with each link's override applied.
- A link override's bindings win over the world stat's, as in play.

## Acceptance criteria

- [x] A Change By edited on a world stat reaches an entity that links it, after load. (`src/lib/statBackfill.test.ts` > `refreshGameStateBindings`, world stat test)
- [x] A link override's Change By reaches that entity, after load. (`src/lib/statBackfill.test.ts` > `refreshGameStateBindings`, link override test)
- [x] An entity's own stat still refreshes as before. (`src/lib/statBackfill.test.ts` > `refreshGameStateBindings`, own stat test)
- [x] Mutation: drop the linked-stat lookup, and the link test fails. (Reverted to `e.stats`: both link tests failed.)

## Landed

**Not verified**

- Load of a real save through `loadGame`: only the `refreshGameStateBindings` unit is tested. Typecheck covers the new `worldStatGroups` argument.

**For you**

- None.
