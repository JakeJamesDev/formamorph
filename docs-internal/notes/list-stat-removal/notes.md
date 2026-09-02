# The `list` stat type — investigation and removal

**Status:** removed 2026-08-05. This is the evidence record, not a proposal. The live direction for the problem it was reaching at is **per-entity runtime fields** — see §1 of [world-authoring-feature-notes.md](docs-internal/notes/world-authoring-feature/notes.md).

---

## 1. What it was

Upstream v1.1 shipped a third stat type, `list`, whose `value` was an array of `{ id, name, description, number }`. It arrived commented out of the editor's type dropdown in the very first commit (`e608a3d`) and was never reachable, so no world could contain one. `StatType`, `StatListItem`, three item handlers, and a full item editor all existed.

## 2. Why it couldn't work

A stat is a bounded scalar. A list inherits none of the machinery that makes one:

| Stat affordance | Meaning for a list |
|---|---|
| `min` / `max` | nothing — an item count isn't a bounded scalar |
| `regen` | nothing; if authored non-zero it corrupted the array to `NaN` on turn 1 |
| `descriptors` (threshold bands) | nothing — the band lookup divides by the range, so it never fired |
| `code` (QuickJS) | must return a number; can't express items |
| `morphBindings` | nothing |
| AI stat-update channel | `Name: ±N` deltas only — no way to add or remove an item |

Traced end to end, every scalar consumer — `buildStatContext`, `applyAiStatChanges`, regen, `statBackfill`, the stat panel — did arithmetic on the array and produced `NaN`, which then serialized to `null` on save. The items never reached the AI at all. Finishing it in place meant a "not for lists" branch in each of those permanently, plus one in every stat feature added later (morph bindings and story-clock code both post-date it).

## 3. Rejected alternatives

**Finishing it as a stat type** — rejected for the above. The expensive parts (an AI item-mutation protocol with probe evidence, prompt rendering, a play-panel surface, save shape) are unaffected by where the data lives, so keeping it in the stat union bought nothing.

**A general inventory system** — rejected on framing, from real authoring experience rather than analysis. Modeling a herd of characters as items imports the wrong verbs (acquire, drop, stack, count) and none of the right ones; a mare is a character, not a possession. The narrower "what the player carries" case doesn't independently justify a new top-level collection either — milestone memory and the character diary already persist that kind of fact at zero cost (see the fallback in §1 of the authoring notes).

**The live answer:** author-defined **per-entity runtime fields** — schema in the authored world, values in the save, riding the existing stat pass and reusing `discoveredEntities` / `runtimeCharacters.ts`. Export-shape-visible on both world and save, so it needs a version decision before anything is built. Full rationale in the authoring notes.

## 4. What landed

- `StatType` narrowed to `'number' | 'percentage'`; `StatListItem` deleted; `Stat.value` narrowed to `number` (which also removed two `as number` casts)
- The editor's type option, its item handlers, and the item editor removed from [StatManager.tsx](src/managers/StatManager.tsx)
- `coerceLegacyListStats` in [version.ts](src/lib/version.ts) retypes any surviving `type: 'list'` stat as a number seeded at its floor. No bundled world used one, so this only affects third-party v1.1-era worlds — where the stat was already producing `NaN` in play, so nothing working is lost.
