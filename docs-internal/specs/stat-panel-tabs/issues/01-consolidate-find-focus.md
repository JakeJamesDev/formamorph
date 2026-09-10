# 01: Consolidate The Find-Focus Path

Status: ready-for-human
Base: a9077a07
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

A contained refactor with its own proof. Two panels answer "which tab holds this field" with their own map, and the editor writes the "is this hint for the item I am showing" guard at two call sites. The third tabbed panel would add a third copy of each, so this unit makes them one before it arrives.

## What to build

A world author using Find sees no change: a hit inside an entity or a location still opens the owning tab and rings the field, and a hit on the same item while Find is open behaves as it does today.

Under that, one helper takes a field key and a panel's field-to-tab map and answers the tab or null. One guard in the editor pairs a focus-field hint with the item it is for, and both the entity and location panels receive their hint through it. The focus-field shape gets a named type in the shared types module, used by the editor and every panel that takes the hint, including the Overview panel. The entity and location tab modules keep their own maps; only the lookup and the guard are shared.

## Acceptance criteria

- [ ] One exported tab-for-field helper; the entity and location tab modules call it with their own map.
- [ ] One item-id guard in the editor; both call sites use it.
- [ ] A named focus-field type in the shared types module, used by the editor and every panel that takes the hint.
- [ ] The entity and location find-focus cases in the World Editor bench-harness suite pass unchanged.
- [ ] The find-focus suite still passes.
- [ ] Four gates green; graph updated.

## Blocked by

- None (can start immediately)
