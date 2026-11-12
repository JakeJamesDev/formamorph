# 10: Stop Storing the List and Guard It

Status: done
Blocked by: 03, 04, 05, 06, 07, 08, 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An entity with a kind stops storing `locations`. Its routine is the only source of its places. A lint rule then keeps every reader on the Entity Places module.

**This changes the export shape** of world files and entity card files (Q1). Say so in the landing and in the hand-off. Released v3.6.2 has no entity kinds, so it reads such an entity from a newer world as placed nowhere. That is accepted.

- **The writers.** Every edit that today rebuilds the derived list stops doing so. The helper that rebuilds it goes, with all of its call sites. Changing an entity's kind, adding or removing a Start, editing a row, deleting a location, and the dev fixtures all leave an entity with a kind without the field.
- **Reading an old file.** A world or card from v3.6.2 or earlier has entities with no kind and a membership list. The existing migration that gives such an entity its kind and Starts keeps reading that list as its input, through the module, and then drops it. There is no new migration step for unreleased worlds that have a kind and a stored list (Q5): the module ignores the field for an entity with a kind, and the next save drops it.
- **The one-time rewrite.** Remove the stored list from every entity with a kind in the bundled worlds and in `worlds-wip`. Follow the bundled-worlds skill: work through its image-stripped copy, and update the bundled fingerprints. The rewrite changes nothing else in those files.
- **No-kind entities.** The Custom Persona and any entity with no kind keep the stored list. Only the module reads or writes it.
- **The lint rule.** A read of an entity's `locations` outside the module fails lint. It joins the existing custom rules. It must not fire on a `locations` field of another type, such as the world's location list. Any reader still outside the module at this point moves here; the landing names each.
- **Docs.** The world format doc states the new shape and what an older build shows. The script guide changes if it names the stored list.

Spec rulings: Q1, Q2, Q3, Q5. ADR-0017.

## Acceptance criteria

- [x] After any routine edit in the editor (kind change, Start added, Start removed, row edited, location deleted), an entity with a kind has no `locations` field. One test per edit; each fails when the old rebuild is restored. *RoutineTab.test.tsx (kind switch, Add Start, add and delete row, delete Start), entityKind.test.ts, entityPresence.test.ts (`dropLocationFromEntities`), routineMapEditing.test.ts; each rebuild reinstated once went red.*
- [x] An exported world and an exported entity card hold no `locations` on an entity with a kind. *entityPlaces.storage.test.ts through `serializeWorldFile` and `buildEntityCardData`. The card format never carried `locations`, so its case documents the contract rather than guards a change.*
- [x] A world from v3.6.2 loads, each legacy entity gets its kind and Starts as before, and its Presence equals its old membership list. A test uses a stored v3.6.2 fixture. *`src/test/v3.6.2-veilwood-world.json`, cut from the released Veilwood (places and cast only); entityPlaces.storage.test.ts: no place lost, and the only extras are the starting locations a migrated "every location" entity gets from its Player's Starting Location Start (Q7). The migration table's own cases stay in version.test.ts.*
- [x] An unreleased world whose entity with a kind still stores a stale list loads with places from the routine only, and saves without the field. *entityPlaces.storage.test.ts; version.test.ts. The load drops it (Q32).*
- [x] The Custom Persona keeps its stored locations across a load and a save. *entityPlaces.storage.test.ts.*
- [ ] No bundled world and no `worlds-wip` world stores `locations` on an entity with a kind. The bundled world test asserts it. *Bundled: bundledWorlds.test.ts "stores no locations on an entity with a kind". `worlds-wip` is untracked in the main checkout; see Landed.*
- [x] For every bundled world, each entity's Presence after the rewrite equals what the stored list gave before, plus only the places Q7 adds (Player's Starting Location expansion and Can Also Go). A test compares against the pre-rewrite files from git. *bundledWorlds.test.ts, against the `preEntityPlaces` pin in scripts/pinnedCommits.json. No place was lost.*
- [x] The rewrite's diff to each bundled world contains only removed `locations` entries. The landing shows the diff stat. *435 lines removed, none added; stat in Landed.*
- [x] The helper that rebuilt the derived list is gone, with no caller left. *`withDerivedLocations` and `dropRoutinePlace` removed; typecheck.*
- [x] The lint rule fails on a read of an entity's `locations` outside the module, passes inside it, and does not fire on the world's location list. Tests in the custom-rule test file cover all three. *eslint.rules.test.ts: `no-raw-entity-places` cases and the config rows.*
- [x] The whole app source passes the new rule. The landing lists any reader that had to move in this ticket. *ESLint over every non-test file in src: 0 reports.*
- [x] The agreement test still passes with the field gone. *entityPlaces.agreement.test.ts, now with a stale list on two entities.*
- [x] The world format doc states the new shape and the older-build behavior. *docs/WorldFormat.md.*
- [x] The landing and the hand-off carry the export-shape reminder.
- [x] A changelog fragment records the file format change for authors. *docs-internal/changelog.d/entity-places-10.md.*

## Landed

> ⚠️ **Export shape changes.** World files and entity card files no longer hold `locations` on a Unique or Generic entity. v3.6.2 shows such an entity nowhere.

**Readers moved in this ticket** (every one the new rule found):

- `src/lib/entityPresence.ts`: the play projection `entitiesInPlay` and the rosters `entityIdsAt` / `entityIdsAtAny` now live in the module (re-exported); `dropLocationFromEntities` reads named places.
- `src/lib/authoringTour/steps.ts`, `inPlay.ts`: the tour entity's places come from Presence.
- `src/lib/entityPicking.ts`, `src/managers/routine/RoutineTab.tsx`, `src/lib/useLibraryLinking.tsx`, `src/lib/worldUpdateReview.ts`: no-kind membership through `namedPlacesOf` and `withMembership`.
- `src/lib/sandboxSnapshot.ts`: a run with no live positions reads Position only, so an entity with a kind stands nowhere (Q10; the app's no-position runs already go through `authoringStateOf`).
- `src/lib/runtimeCharacters.ts`, `src/lib/devFixtures.ts`, `src/lib/chipValues/sampleScene.ts`, `src/test/entityKindFixture.ts`: writers.
- `src/lib/version.ts`, `src/lib/entityKind.ts`: the migration and the kind switch read membership through the module and drop it.

**The lint rule** is the repo's first type-aware rule (`eslint.no-raw-entity-places.js`): it fires on the `locations` the `Entity` interface declares, through any `Pick`, so a world's list never trips it. It adds a project load to lint: about 17 s over all of src, and the rule tests take about 8 s for it.

**Bundled rewrite** (`git diff --stat` of `src/defaultworlds`): drone 49, emberwatch 60, rampage 72, slime 57, sugarscape 72, valentines 51, veilwood 74 lines removed; 435 deletions, no insertions. Open Chat has no entity with a kind.

**Not verified**

- `worlds-wip` rewrite: the folder is untracked in the main checkout, and a ticket worktree never writes there. The session runs the same one-off rewrite on it after the landing and reports the counts.

**For you**

- Open one bundled world and one of your `worlds-wip` worlds, and check that every character is where you expect on the Presence tabs and in a new game.
