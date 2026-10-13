# 01: `stats` Means The World, `owner` Is The Owner

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Changes the sandbox's binding contract and the turn runner's per-owner inputs together, and rewrites bundled code. Opus at high effort.

## What to build

In every owner's code, `stats` is the world stats, without Blueprint stats. A new top-level `owner` is the entity that owns the running stat. It has the same shape as an `entities[x]` entry (`stats`, `traits`, `placeholders`). In world-stat code, `owner` is an empty entry: reads are blank, and writes are dropped and reported. In Blueprint stat code, `owner` is the bearer the run is for (Q1, Q2, Q5).

An owned stat's `self` is its entry in `owner.stats`. In world-stat code, `self` stays its entry in `stats`. The own-owner writes v6 allowed through `stats.Name` now go through `owner.stats.Name`, with the same rules. `owner.traits` switches the owner's traits by the existing trait-switch path.

For `stats`, an owner's run passes the world run's code names, turn inputs, and enabled map. For `owner.stats`, it passes its own. `owner` is keyed by entity id. The empty `owner` is its own entry, never the persona's. When the owner is in the game, `owner` is the same object as its `entities` entry, even when a later entity with the same name hides that entry in `entities`.

The bundled drone (Mobility, Firepower) and The Student (Agility) code moves from `stats.X` to `owner.stats.X`. There is no migration, because entity stats are in no release.

Writes to other owners stay read-only in this ticket. Ticket 02 opens them.

## Acceptance criteria

- [ ] In an entity stat's code, `stats.Destruction.value` reads the world stat (City Rampage, The Creature)
- [ ] In an entity stat's code, `owner.stats.X` reads and writes the owner's stats, and `self` and `owner.stats.<own name>` are one write
- [ ] In world-stat code, `owner` reads blank, and a write through it is dropped and reported with the path as written
- [ ] In Blueprint stat code, `owner` is each bearer in turn, and a write through `owner.stats` reaches that bearer's copy
- [ ] `stats` leaves Blueprint stats out in every box
- [ ] `owner.traits.<name>.enabled` switches the owner's trait
- [ ] Bundled drone and The Student code runs with the same results as before, through `owner.stats`
- [ ] The turn and executor seams prove each guard by reinstating the owner-scoped `stats` once
- [ ] Four gates green

## Blocked by

- None (can start immediately)
