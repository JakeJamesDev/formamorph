# 08: Scripts Read and Introduce Met

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Scripts read `met` on an entity entry, and call `meet()` to introduce an entity, for example when a found letter reveals who the stranger is. `meet()` on a met entity does nothing. Met never un-sets.

## Acceptance criteria

- [x] `entity.met` reads the Presence module's met value. `statCodeTraits.test.ts` (met list, persona, no-list fallback); `openingState.test.ts` (start rule).
- [x] `entity.meet()` makes a stranger met, and a later read in the same turn sees it. `statCodeExecutor.entityWrites.test.ts` (same-run read, owner, unknown entry).
- [x] `meet()` on a met entity changes nothing. The persona case is tested; the commit append dedupes through `withMet` (existing test).
- [x] The surface catalog, hover cards and Scripts guide describe `met` and `meet()`. `statCodeVariableTree.test.ts` (cards), `codeSurface.copy.test.ts` (copy limits), `docs/ScriptsGuide.md`.

## Landed

Q74 (spec session): `met` ships wherever entity entries do; `meet()` only where entity writes are allowed, so a user Tool script has no `meet()` (`toolRunner.test.ts`).

**Not verified**
- The commit landing of `meet()` writes in `GameViewer.tsx` has no test (inline in the god node); checked by reading. Undo restores `metEntities` through the saved game state.
- Sandbox sites other than the live turn script and the opening fold read `met` as "no Stranger Name", without ties or Known In picks.

**For you**
- Run a script with `entities.<Stranger>.meet()` in a game and check the map and Help window show the entity from the next turn.

