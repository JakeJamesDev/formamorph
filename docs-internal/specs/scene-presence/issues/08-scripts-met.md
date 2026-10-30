# 08: Scripts Read and Introduce Met

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Scripts read `met` on an entity entry, and call `meet()` to introduce an entity, for example when a found letter reveals who the stranger is. `meet()` on a met entity does nothing. Met never un-sets.

## Acceptance criteria

- [ ] `entity.met` reads the Presence module's met value.
- [ ] `entity.meet()` makes a stranger met, and a later read in the same turn sees it.
- [ ] `meet()` on a met entity changes nothing.
- [ ] The surface catalog, hover cards and Scripts guide describe `met` and `meet()`.
