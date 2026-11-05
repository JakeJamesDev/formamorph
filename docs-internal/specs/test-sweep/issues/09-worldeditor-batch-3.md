# 09: WorldEditor Batch 3

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: Repeats a set pattern; judgment is limited to following it and its proof recipe.

Parent: [Test Sweep spec](../spec.md)

## What to build

The second batch the pilot's note assigns moves off the full view mount (Q7), using the pilot's pattern and helpers.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q7, Q22, Q23.

## Acceptance criteria

- [x] Only tests the note assigned to this batch moved. The 19 files of "Ticket 09" are the only view files touched; 177 test rows before and 177 after, none deleted, none added.
- [x] Time before and after is recorded in the ticket. See Results.
- [x] Q5 tests keep their mutation kills; other tests show held coverage and one reinstated bug turning red. 31 pairs, each exit 0. Reinstated bugs are under Results.
- [x] The `panelWorld` and harness copies in `panelBench` are gone once the view moves end, and `worldEditorBench` changes only then. `worldEditorBench` now imports `panelWorld`, `asMobile`, `panelTabLayout`, `entityFieldsTab` and `openTraitFieldsTab` from `panelBench`, and both benches share `src/test/worldHarness.tsx`.

## Results

**Group:** Entities, Dictionary, Placeholders, Locations, Overview and Tools, 19 view files. 124 of 177 rows moved to 18 panel files; 53 rows stay on the view mount in 7 files (one per tab: `entitiesTab`, `dictionaryTab`, `placeholdersTab`, `locationsTab`, `overviewPanel`, `itemsTab`, `tools`).

| 177 test rows, one run of each layout under peer load | Before | After |
|---|---:|---:|
| Test bodies | 101.9 s | 52.2 s |
| Wall time | 19.7 s | 13.2 s |
| Files | 19 | 25 |
| Test rows on the view mount | 177 | 53 |

These are single runs, not alternating runs, so read them as a ranking.

| New file | Module it exercises |
|---|---|
| `useWorldToolsAdapter.test.tsx` | `useWorldToolsAdapter` |
| `useWorldDictionaryAdapter.test.tsx`, `DictionaryManager.panelTabs.test.tsx`, `DictionaryBookManager.panelTabs.test.tsx` | dictionary adapter, entry panel, book panel |
| `useWorldPlaceholdersAdapter.test.tsx`, `.blueprints.test.tsx`, `PlaceholderOwnerPanel.test.tsx` | placeholders adapter, scoped list in entity and book panels |
| `useWorldLocationsAdapter.test.tsx`, `.delete.test.tsx`, `LocationManager.panelTabs.test.tsx` | locations adapter, location panel |
| `useWorldEntitiesAdapter.test.tsx`, `.panelTabs.test.tsx`, `EntityStatsMirror.test.tsx`, `EntityTraitsMirror.test.tsx`, `EntityBodyField.test.tsx`, `PlacementsSection.startingItems.test.tsx` | entities adapter, entity panel and mirrors, Body select, starting items |
| `WorldOverviewManager.test.tsx`, `OpeningsPanel.toolbar.test.tsx` | Overview column, Openings toolbars |

**Helpers:** new hosts `entitiesTabBench`, `dictionaryTabBench`, `placeholdersTabBench`, `locationsTabBench`, `toolsListBench` and `overviewBench` in `src/test/`. The Overview host mounts `WorldOverviewManager` and `WorldDetailsManager` together.

**Moves that needed the view, left there:** every test that visits another tab, selects the Entities tab by its editor strip, uses Find, the mode switch, the chord undo, the mobile Back, the palette bar above the entity strip, the List/Canvas switch, and the four column-layout tests of the Overview. One helper changed in a moved file: `panelLabels` in the entity panel tabs file reads `queryAllByText`, because the view always had an unrelated "Locations" tab label to find. Its assertions are unchanged.

**Kept protection:** 31 pairs, each exit 0 with 0 lost lines and branches: the view (`WorldEditor.tsx`), 24 panel modules, and the Q5 modules the moved tests drive (`blueprints.ts`, `scripts.ts`, `statCodeTemplates.ts`, `version.ts`, `GameDataContext.tsx`, `ScriptBox.tsx`) under Q50. First runs lost lines in the view (`editorToolWorld`, lines 216 to 217, reached only by the Tool editor flow, and one branch reached only by selecting a folder in the Entities tab), so `leaves the world unchanged until Save Tool`, `lists the world's Tools in run order`, `warns that a Tool named like a built-in Tool` and `opens a folder's panel from the tree` stayed on the view. Four panel pairs showed lost lines that only other moved files held; their after lists now name every new file.

**Reinstated bugs, each turning a moved test red and then restored:**
- `useWorldToolsAdapter.tsx`: swapping the owner word in `clashNote` turned "refuses a name another Tool in the world uses, and saves a built-in name" red.
- `useWorldLocationsAdapter.tsx`: dropping `onSelect(copy.id)` from duplicate turned "duplicates a search row right after the original and opens the copy" red.
- `useWorldEntitiesAdapter.tsx`: dropping `onSelect(res.newId)` from duplicate turned "duplicates an entity and opens the copy" red.
- `GameDataContext.tsx` (Q50): `removeLocation` no longer dropping the id from entities turned both "drops the id from entities and Connections when deleted from the tree" and "does the same when deleted from the filtered list" red.
- `WorldOverviewManager.tsx` (non-Q5 module): writing `'any'` instead of clearing `allowedPersonas` turned "reads absent rules as Any on the player default, and Any writes no field" red.

**Q50 gap:** no moved test turns red when `blueprints.ts` is broken at `isCopy`, `effectiveCopy` or `withEffectiveCopies`; the moved panel tests read `blueprintId` directly. Its coverage pair holds, and the Q5 lines it covers are held by `blueprints.test.ts`.

**Q5 modules under test:** none of the new panel files has a Q5 module under test. The view files still credit `WorldEditor.tsx`; a mutation run of it was not made (about 1174 mutants).

## Landed

**Not verified:** a mutation run on `WorldEditor.tsx` (Q23 for a Q5 view module; the pilot and ticket 08 made none either). Alternating before and after timing runs: the times above are single runs.

**For you:** nothing; no product code changed. `worldEditorBench` changed, so the ledger records of the 96 view files that import it are stale until refreshed.
