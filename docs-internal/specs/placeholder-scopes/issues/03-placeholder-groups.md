# 03 — Placeholder groups

Status: done
Type: task
Blocked by: 02
Spec: ../spec.md (Groups)

## Task

- `types/world.ts`: `PlaceholderGroup { id, name, parentId: string | null, order? }`,
  `World.placeholderGroups?`, `Placeholder.groupId?: string | null`. Migration is a no-op: absent
  means ungrouped.
- `lib/placeholderTree.ts`: group rows above root placeholder rows, nestable, following
  `lib/entityGroupTree.ts` (`buildEntityTree`, `getEntityDropProjection`, `applyEntityDrop`). Only
  shared placeholders may drop into a group; a scoped one or an owner node refuses the projection.
- `WorldEditor.tsx`: the `FolderPlus` popover item on the Placeholders tab, advanced mode;
  `handleAddPlaceholderGroup` like `handleAddEntityGroup`. A `PlaceholderGroupManager` panel with a
  plain `<Input>` name, like `EntityGroupManager`.
- Palette (`PlaceholderPaletteBar.tsx`) and `ChipTypeahead.tsx`: a heading per group in tree
  order; ungrouped shared placeholders first under no heading; owner-scoped placeholders under the
  owner's name. A heading with no visible chip is hidden.
- Export: `groupId` dropped from `buildEntityCardData` / `buildDictionaryFile` output.
- **Export-shape change**: say so in the response.

## Acceptance

- Tree test: two groups, one nested, three placeholders, one scoped; the scoped one cannot drop into
  a group.
- Palette test: headings in tree order, empty heading hidden, ungrouped first.
- Card export carries no `groupId`.
- `devRoutes.ts` still reaches the Placeholders tab; drift-guard test green. Four gates green.

## Outcome

Done 2026-09-02. The folder helpers live in `src/lib/placeholderGroups.ts` (`placeholderGroupOf`,
`childPlaceholderGroups`, `placeholderGroupsInTreeOrder` with its `Body › Face` heading, `withPlaceholderGroup`,
`removePlaceholderGroup`, `portablePlaceholders`). The tab's tree and drop are in `placeholderScopes.ts`, where
ticket 02 put them rather than `placeholderTree.ts`: `placeholderTreeNodes` draws folders first at every level,
then the loose rows, then owners; `applyScopedPlaceholderDrop` moves a folder among folders (the result carries
`placeholderGroups`), files a shared row through the new `groupId` on `PlaceholderDropPlan`, and returns `null`
for a scoped row dropped in a folder or a folder dropped under a row or owner node. `movePlaceholderHome` strips
`groupId` on the way to an owner, and a drop that takes a row privately strips it too. `GameDataContext` carries
`placeholderGroups` with add/update/remove and writes it from `setPlaceholderLists`; the Bench write-back, the
storage type, and the find bar know the field. Palette and typeahead read `ChipRow.heading`, set by the
vocabulary's `groups` option (read off `store.lists`); the palette draws a rule between sections and both draw a
heading off the first visible chip under it. Decisions not in the spec: `groupId` is written as absence, never
`null`; a nested folder's heading is its path; folders offer no duplicate; a placeholder created while a folder
is selected lands loose, as an entity does. The spec's Moves row ("drag a scoped one to root or a group to share
it") conflicts with its Groups row and this ticket; the ticket's rule won, so a scoped row dropped in a folder
is a no-op. Live: the popover, the folder row, its panel and the loose palette were read in the preview; the
drag into a folder and the headings were proven in jsdom and the pure module only. The code review added
`placeholderDropAllowed`, one rule for the drag's indent indicator and the drop, so the indicator refuses what
the drop refuses; the folder delete goes through the store's `setLists` only; the palette and menu share
`chipSectionOpens`. Named, not done: a `slicesOf(world)` helper for the four spellings of the slice clump, the
World Editor's per-tab add ternaries, and the two older group-removal copies in the context.
