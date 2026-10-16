# 02: Code Writes Any Stat

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Changes write marshaling and the landing order across owners, next to bounds ledgers, gates, and penalties. Opus at high effort.

## What to build

Every stat takes writes to `value`, `min`, `max`, and `regen` on every route: `stats`, `owner.stats`, `entities[x].stats`, and `persona.stats` (Q3). Every other field stays read-only on every entry. A whole-map or whole-entry write stays read-only.

The executor returns writes keyed by target owner (entity id), with the same stat-write rows `statWrites` holds. `statWrites` keeps the world-stat writes. The unknown, switched-off, and read-only lists cover every route and name the path as the code wrote it.

The turn runner collects writes from all runs per target. They land in owner order (Q9): Other Stats, then world entities in authored order, then library entities in pick order. Within a writer's owner, stat order still decides. The last write wins per field (Q4). Every run reads one snapshot (Q6). Cross-owner writes merge per target before the first settle, so the gate snapshot and the starvation penalty see them. Bounds book into the code delta as v6 Q14 and Q19 rule.

A write to a switched-off stat, an unknown stat, or an entity not in the game is dropped and reported through the existing dropped-write warnings (Q7).

Write a changelog fragment under the Entity Stats topic.

## Acceptance criteria

- [ ] An entity stat's code writes a world stat, and the write lands
- [ ] World code writes an entity's stat through `entities[x].stats` and the persona's through `persona.stats`
- [ ] Two owners writing one field resolve in owner order, last write wins, including a library persona landing last
- [ ] A write from another run is not seen by any run in the same turn
- [ ] A cross-owner write to a world stat skips the starvation penalty as a world stat's own write does, and the gate snapshot sees it
- [ ] Writes to a switched-off stat, an unknown stat, and an absent entity are dropped and reported with their full path
- [ ] `id`, `name`, `type`, `description`, `previous`, and `delta` stay read-only on every route
- [ ] Existing tests that asserted entity stats are read-only are rewritten to assert the write lands, not deleted
- [ ] The turn and executor seams prove each guard by reinstating the read-only lock once
- [ ] Changelog fragment written; four gates green

## Blocked by

- 01 (`stats` Means The World, `owner` Is The Owner)

## Comments

- 2026-10-13, spec session, handoff from ticket 01 (efab99992): the executor returns `ownerStatWrites: [{ ownerId, writes }]`, so far only for the run's own owner. `stats` is read-only when `owner` is set (`writable: !owner` in the stats prelude); this ticket opens it. An `owner.traits` row on an entry of its own carries `owner: true` with `entity: ''`.
