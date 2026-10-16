# 08: Stat Renames Follow Every Route

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Extracts the Test Bench's per-owner target resolution into a shared module and moves the rename planner onto it, across every box in the world. Opus at high effort.

## What to build

Renaming a stat updates every code reference to it, on every route and in every box.

- Renaming a world stat offers to rewrite `stats.X` in every box: world, entity-owned, Blueprint, and link overrides. Since Q1, an entity box's `stats.Destruction` reads the world stat.
- Renaming an entity's own stat offers a rename too. Today it offers nothing. The rewrite covers `owner.stats.X` in that entity's own boxes and its Blueprint bearer runs, `entities[x].stats.X` wherever `x` names that entity, and `persona.stats.X` when that entity can be played.
- A reference that reaches another stat with the same name is left alone. A world stat and an owned stat that share a name never rewrite each other's references.

The route-to-target resolution the Test Bench rules use (box owners, write targets, the boxes of a world) moves into one shared module. The Test Bench and the rename planner both use it. The Code Hover Cards spec's Find All Uses reuses it later, so its interface takes a world and returns each reference with its box, its route, the stat it reaches, and the key's range (from and to) in the box's code.

## Acceptance criteria

- [ ] Renaming the world stat Destruction rewrites `stats.Destruction` in a world box and in The Creature's own box
- [ ] Renaming an entity's own stat rewrites `owner.stats.X`, `entities[...]`'s `.stats.X` by dot and bracket, and `persona.stats.X` where they reach that stat
- [ ] A same-name stat on another owner, or in the world, is not rewritten
- [ ] Link override boxes and Blueprint boxes are scanned
- [ ] The Test Bench rules use the shared resolution, and their tests stay green unchanged
- [ ] The planner seam proves each guard by reinstating the world-boxes-only scan once
- [ ] Changelog fragment under the Entity Stats topic; four gates green

## Blocked by

- None (can start immediately)
