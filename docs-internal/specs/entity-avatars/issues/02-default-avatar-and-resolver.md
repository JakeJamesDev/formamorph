# 02: Default Avatar and Resolver

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the resolver holds every precedence rule the rest of the effort reads, and the edge cases (library persona, Custom Persona, legacy fallback, per-save pick) must be exact.

## What to build

The player marks one library Avatar as their default, the same way they mark a default persona: a device-local key, **Set as Default Avatar** and **Clear Default Avatar** on the Avatar library tile's menu, and a **Default** badge (Q1). No default, or a default that no longer exists, resolves to the bundled Avatar file (Q9).

One pure resolver turns an entity, in context, into its Avatar source: a world store id, a library id, the bundled file, or nothing (spec: Resolver). Its inputs are the entity's pick, the world store, the device default, the played persona, the save's chosen Avatar, and the legacy fallback. An unplayed entity shows only its own pick. The played side follows the spec's precedence table by persona source (library persona, world persona, None; Q4, Q7, Q21). The save's chosen Avatar replaces User's Default for the played entity only (Q10); a legacy save's chosen Avatar replaces the played-side result (Q24). Library-entity picks (ticket 06) use the same resolver, so it accepts a library-id pick now.

## Acceptance criteria

- [ ] Setting, clearing and the badge work on the Avatar library tile; the key is device-local and never exported.
- [ ] User's Default resolves to the device default, else the bundled file, including after the library copy of the bundled Avatar is deleted.
- [ ] Resolver tests cover every cell of the spec's precedence table, an entity pick over the fallback, a deleted store id, an unresolvable library id, and the save's chosen Avatar touching only the played entity.
- [ ] Each guard is proven by reinstating the bug (for example, swap the library persona and Custom Persona order and watch a test fail).
- [ ] Frame `.scratch/frames/02-default-badge.png`, light and dark, 1280 wide.
