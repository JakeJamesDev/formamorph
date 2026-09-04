# 02 — Owner nodes, panel sections, scope moves, display prefix, export/import

Status: done
Type: task
Blocked by: 01
Spec: ../spec.md (Scoped placeholders: Name, Reach, Deleted owner, Moves, Tab display, Panel display, Export, Old files)

## Task

- `lib/placeholderTree.ts`: rows for the Placeholders tab. Root: shared placeholders. Then one
  derived owner node per entity (tree order) and per book that owns at least one placeholder, its
  placeholders beneath. Owner nodes: no rename, no delete, not draggable, selectable to open the
  owner's panel section or a read-only header.
- Scope moves in `applyPlaceholderDrop`: a drop onto an owner node moves the record into that
  owner's list, id kept. A drop to root or a group moves it to `World.placeholders`. Placeholder-owned
  children travel with their holder. Prune `sharedWeights` keys the same way the ownership drop does.
- Display prefix: `ChipVocabulary` gains the owner name. `label` and `display` read
  `Owner.Name` unless the field's `insertOwnerId` (already on `PromptField`) matches the owner. Entity
  and dictionary panels set `insertOwnerId` to their item id on every chip field. `describePlaceholders`
  and `labelPlaceholders` use the same rule with no field context, so plain-text surfaces show
  `Owner.Name`.
- Palette and typeahead: the owner's scoped placeholders listed first while editing the owner's
  fields. Elsewhere they list after shared ones as `Owner.Name`.
- Entity panel (`EntityFields` host in the World Editor) and dictionary panel: a Placeholders section
  mounting `PlaceholderEditor` bound to the item's list. Advanced mode only, matching the library tab.
- Export: `buildEntityCardData` / `buildDictionaryFile` write `placeholders` = owned and
  `sharedPlaceholders` = `collectUsedPlaceholders` over shared refs only. Import (`WorldEditor`
  `onAdd` sites): keep owned with fresh ids + `remapPlaceholderIds`, `absorbPlaceholders` over
  `sharedPlaceholders`, clear the field. `Entity.sharedPlaceholders` / `Dictionary.sharedPlaceholders`
  are optional and off-world only.
- Old files: `placeholders` reads as owned. No migration.
- **Export-shape change**: say so in the response.

## Acceptance

- Tree test: an entity with one scoped placeholder draws an owner node with one child; an entity with
  none draws nothing.
- Drop test: shared → owner moves the record and keeps the id; owner → root reverses it.
- Vocabulary test: `Molly.Eyes` outside Molly's fields, `Eyes` inside.
- Card round-trip: export an entity with one owned and one shared ref, import into a fresh world,
  the owned one is present with a new id, the shared one absorbed by name + values.
- Four gates green.

## Outcome

Done 2026-09-02. The tab's nodes and the cross-list drop live in `src/lib/placeholderScopes.ts`
(`placeholderTreeNodes`, `applyScopedPlaceholderDrop`, `ownerNodeId`); `placeholderTree.ts` gained an `all`
lookup for rows drawn from one list of several and `commitPlaceholderDrop`, the second half of a drop.
`placeholderHomes.ts` gained the owner index (`placeholderOwners`), `movePlaceholderHome`, `carriedPlaceholders`
and the card/file adoption (`adoptEntityPlaceholders` / `adoptBookPlaceholders`); `scatterPlaceholders` now
lands an unknown id beside the record before it, so a duplicate stays in its source's list. The label rule is
`ownerPrefix` in `placementLetters.ts`, read by `chipPathName`, `labelPlaceholders`, `chipPlaceholderNames` and
the chip vocabulary; the World Editor threads `placeholderOwners` from `useGameData` to every plain-text name.
The store carries `owners`, `lists`, `setLists` and an optional `scope`; `ScopedPlaceholdersSection` mounts
`PlaceholderEditor` over a scoped store in the entity and book panels. Decisions not in the spec: a placeholder
created from the `{` menu inside an owner's fields lands in that owner's list; the library modals read owned
plus carried shared defs and split them back on write, so a card's shared refs survive a library round trip;
`describePlaceholders` was left alone (it prints values, not names). Live drag between sections was not
exercised in the browser; the pure drop tests cover it. The code review caught two bugs, fixed before the
commit: a row's `home` is read off the record, not the section it is drawn in (a shared row under a scoped
holder), and the vocabulary takes an explicit `scope` owner (`useOwnerScope`) so a create inside an owner
that owns nothing yet still lands in its list. Open edge: a chip aimed at another owner's scoped placeholder
exports into `sharedPlaceholders` and imports as shared.
