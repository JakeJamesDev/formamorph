# 01 — Combined placeholder view + scoped storage

Status: done
Type: task
Spec: ../spec.md (Scoped placeholders: Storage, Placeholder-owned inside a scope)

## Task

- `lib/placeholders.ts` (or a new `lib/placeholderHomes.ts`): `allPlaceholders(world)` returns
  `World.placeholders` + every `Entity.placeholders` (entity tree order) + every
  `Dictionary.placeholders` (book order), reference-stable when nothing changed.
  `placeholderHome(world, id)` returns `{ kind: 'world' } | { kind: 'entity', ownerId } |
  { kind: 'dictionary', ownerId }`.
- `PlaceholderStore` (`contexts/PlaceholderStoreContext.tsx`) in `GameDataContext`: reads serve the
  combined view; a write routes to the list that holds the id. A create takes an optional home.
  The library modals' isolated adapter is unchanged.
- Every reader that takes `world.placeholders` switches to the combined view: `resolveWorldNames`,
  `useResolvedAuthoredWorld`, `primeRolls` callers, `placementLetters` (`worldPlacementTexts` walks
  the combined list at the end, same order as `allPlaceholders`), `worldSearch`, `chipVocabulary`
  (`placeholderVocabulary`), `PlaceholderPaletteBar`, `ChipTypeahead`, the Test Bench
  (`lens.ts`, `opening.ts`, `aiContext.ts`), `authoredPreviewValues`, export builders.
- `Placeholder.ownerId` inside a scoped list keeps its meaning. `placeholderRows` builds rows per
  list; ticket 02 draws the owner nodes.
- `duplicateEntityNode` and dictionary duplicate: re-mint owned placeholder ids and remap the copy's
  chips (`remapPlaceholderIds` over the copy's own texts and its placeholders' values).
- Delete entity or book: its placeholders go with it. No cascade elsewhere.
- **Export-shape change**: say so in the response. `Entity.placeholders` and
  `Dictionary.placeholders` are live in the world file.

## Acceptance

- `allPlaceholders` returns the same array reference for an unchanged world.
- A write to a scoped placeholder through the store lands on the entity, not the world list.
- A chip in a location resolves a scoped placeholder in play (`GamePanels.test.tsx`).
- Duplicating an entity yields distinct placeholder ids and chips that resolve to the copy's own.
- Four gates green. `graphify update .` run.

## Outcome

Done 2026-09-02. Pure module is `src/lib/placeholderHomes.ts` (`allPlaceholders`, `placeholderHome`,
`scatterPlaceholders`, `mapListHolding`, `mapAllPlaceholders`, `withoutPlaceholders`,
`remintScopedPlaceholders`, `duplicateEntityPlaceholders`, `remapEntityChips`, `remapBookChips`).
`useGameData().placeholders` is the combined view; `worldPlaceholders` / `setWorldPlaceholders` are the
world's own list. The store routes add (optional home), update, remove, and whole-list writes. Readers that
take a world object go through `allPlaceholders(world)`: placement letters, the Test Bench (rules, lens,
opening, AI context, triggers, stat-code check, trigger semantics), `authoredPreviewValues`, the publish
and library blurbs, the advanced-data check. Bench fixes repair a scoped placeholder where it lives.
There is no dictionary-book duplicate action in the editor (only entries duplicate), so only the entity
duplicate re-mints. No changelog entry: nothing in the UI can create a scoped placeholder until ticket 02.
