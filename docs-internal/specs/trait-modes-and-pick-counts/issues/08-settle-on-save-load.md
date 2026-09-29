# 08: Settle on save load

Status: ready-for-human
Base: 514bf3a6
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: a small wiring change at the load boundary, but it touches stat application and the cascade-off state of existing saves.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

When a save loads, every bearer's traits settle against the current world (Q34). A world edit that adds an ungated Always On trait, or turns a switched-off Optional trait into Always On, takes effect as soon as the save loads, not at the next switch or persona change. The world stays authoritative for saves.

## Acceptance criteria

- [ ] Loading a save runs settle for every bearer with the save's cascade-off state. Always On traits whose gates hold join. Traits whose gates no longer hold turn off and join the cascade-off list.
- [ ] Traits that join or leave on load apply or reverse their stat changes exactly as a switch would.
- [ ] A save whose traits already match the world loads with no change and no log line.
- [ ] A trait that changes on load is logged like a switch, so the player sees what changed. A Hidden trait is not named, as in ticket 05.
- [ ] Tests: an old save meeting a new ungated Always On trait; a save whose gated trait lost its gate; the no-change load. Each guard is shown to bite.
- [ ] The changelog line is in In Progress.
