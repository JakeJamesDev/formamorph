# View Move Pattern

How a `WorldEditor` panel test moves off the full view mount (Q7). The pilot was the Items tab in [ticket 07](issues/07-worldeditor-pilot.md), which has the measured results.

## What stays a view test

A test stays on [`worldEditorBench`](../../../src/test/worldEditorBench.tsx) only when the view itself makes it pass.

| Stays in the view | Moves to the panel |
|---|---|
| Tab order and which tabs show | The list's rows, add, duplicate, delete |
| The shared search box reaching a tab's list | Filter behavior inside one list |
| A section's place in the editor ("leaves the Overview") | A panel's fields, tabs and writes to the world |
| Navigation between tabs, Find, the tour, the Bench | Dialogs a panel opens |
| Chords, the pill, Save, leave prompts | Undo of a panel's write, through `history().undo()` |

Keep two to four wiring tests per tab.

## How to move a group

1. **Capture before.** Coverage per module needs the old tests, so run it first, with `--runs 1`.
2. **Move mechanically.** Swap the mount, drop the tab open, and leave every assertion and test name byte-identical. A count of old and new `expect` lines shows a slip.
3. **Name each file after the module its tests exercise:** `src/managers/<Panel>.test.tsx`. Q8 credits coverage to that module alone, so a thin wrapper's name hides the real one. Split a suite when its tests live in separate modules, and mount the smallest module that passes.
4. **Merge the kept tests into one view file per tab,** because each view file costs about 2 s of imports.
5. **Prove it.** Use [Kept-Protection Check](kept-protection.md): one folder pair per module, plus one reinstated bug.

## Shared helpers

[`panelBench`](../../../src/test/panelBench.tsx) never imports the view.

| Helper | Use it for |
|---|---|
| `renderPanelBench(world, mode, <Panel />)` | A panel that reads only `useGameData` |
| `renderListTab(world, mode, useTab)` | A tab with a List Editor adapter. `useTab` holds the panel state the view holds |
| `renderListParts(world, mode, useParts)` | A tab that builds its List Editor parts itself, like the Media tab. `useParts` returns `{ parts }` |
| `withEditorProviders` | The rename, preview-rolls and chip-insert providers the view adds. Both list renderers wrap with it by default |
| `panelWorld(over)` | The same base world as `benchEditorWorld` |

[`itemsTabBench`](../../../src/test/itemsTabBench.tsx) is the example of a `useTab` host. `statsTabBench`, `traitsTabBench` and `mediaTabBench` follow it; the adapter hosts get the view's shared `search` in their selection.

A test that goes to another tab (Go to, a chip that opens a row, the Entities tab) stays on the view: the hosts leave navigation idle, and a no-op would rig the test. Undo in a moved test goes through `history().undo()`.

### What the bench does not give you

- ⚠️ **It leaves out four of the view's providers.** They are `CodeRenameProvider`, `EditorPreviewRollsProvider`, `ChipInsertTargetProvider` and `CodeCardNavigationContext`. A panel that reads one gets a quiet fallback and no error, so an assertion that a rename offer is absent passes for the wrong reason. Stat, trait, entity, location and placeholder managers use `useRenameField`: wrap those mounts in the provider, or keep the test in the view.
- ⚠️ **`ListEditor` is not how the view lays out its parts.** The view composes them itself through `ListDetail`. A test about layout stays in the view.
- ✅ **`useWorldMediaEditor` returns list parts, not an adapter.** Ticket 08 added `renderListParts` for it.
- ⚠️ **Name a new test file after a module, and check the name is free.** `StatManager.test.tsx` already held another suite, so the panel tests are `StatManager.panelTabs.test.tsx`.

### Leave `worldEditorBench` unchanged

Its hash is an input of the 96 view files' records that import it, so an edit makes their coverage stale. `panelWorld` and the harness repeat its code until the view moves end, and ticket 09 removes the copies.

## Traps

- **Keep the service mocks in each test file,** because `vi.mock` is hoisted per file.
- **A coverage pass with no timed run writes 0 records,** and the check then has nothing to read.
- **The world loads in an effect.** Read `ctx()` after the render returns, as the view tests do.
- **Q5 by ledger area matches path words only.** Before a move, check what the panel reaches: `src/lib/blueprints.ts` is in the Q5 table, and `PlaceholderCopyEditor`, `TraitLinkPanel` and `WorldOverviewManager` import it. A file whose module under test is in that table keeps its mutation kills (Q23).
- **A moved test that calls Q5 code from a non-Q5 module** takes no mutation run while its assertions stay byte-identical and that code stays unmocked (Q50). Add coverage pairs on that code, listing every touched file, and put the reinstated bug there.
- **Time both layouts in alternating runs.** Peer load moved the same 88 tests from 25 s to 40 s here.

## Batches

Times are body seconds from the ledger of 2026-11-05, under full-suite load. Alone, the pilot's 71.4 s measured 25.0 s, so read these as a ranking. Each name is `src/views/WorldEditor.<name>.test.tsx`.

### Ticket 08: Media, Stats and Traits

| Tab | Files | Body s |
|---|---|---:|
| Traits | `traitsListEditor`, `traitPanel`, `traitRequires`, `ownedTraits`, `fasterAuthoring`, `systemNodes`, `linkOverrides` | 62.7 |
| Media | `mediaTab`, `mediaImagePanel`, `mediaActions`, `mapBackground` | 60.8 |
| Stats | `statsListEditor`, `statPanel`, `ownedStats`, `statBlueprints` | 41.4 |

### Ticket 09: Entities, Dictionary, Placeholders, Locations, Overview and Tools

| Tab | Files | Body s |
|---|---|---:|
| Entities | `entitiesListEditor`, `entityPanel`, `entityAdd`, `entityStatsMirror`, `entityTraitsMirror`, `placements`, and the 3 Body select tests in `itemsTab` | 53.3 |
| Dictionary | `dictionaryListEditor`, `dictionaryPanel`, `bookPanel` | 26.3 |
| Placeholders | `placeholdersListEditor`, `scopedPlaceholders`, `placeholderBlueprints` | 25.7 |
| Locations | `locationsListEditor`, `locationPanel`, `locationDelete` | 20.8 |
| Overview | `overviewPanel`, `openingsToolbar` | 18.8 |
| Tools | `tools` | 5.8 |

### Not assigned

These 63 files stay on the view unless a later ticket shows otherwise.

| Why | Files |
|---|---|
| 🧭 The tour and play | `authoringTour`, `authoringTourEnding`, `tourStart`, `tourLocations`, `tourEntities`, `tourStats`, `tourTraits`, `tourDictionary`, `tutorial`, `inPlay`, `inPlayMobile` |
| ↩️ History across tabs | `history`, `historyFieldPulse`, `historyReveal`, `historyOrigin`, `historySubView`, `fieldHistory`, `fieldIdentity`, `controlIdentity` |
| 🔎 Find and navigation | `findExpand`, `findFocus`, `findUses`, `findLogicTabs`, `entityNavigation`, `traitNavigation`, `locationNavigation`, `statNavigation`, `dictionaryNavigation`, `tabNavigation`, `landing`, `cardOpen`, `worldSourceOpen`, `statDescriptorRename`, `codeInsert` |
| 🧪 The Bench | `bench`, `fix`, `imageWebpFix`, `sourceChecks`, `connectReferences`, `contentLink` |
| 🖼️ Library and Avatars across tabs | `libraryLinks`, `libraryAvatars`, `worldAvatars`, `legacyAvatar` |
| 🧱 The view's shell | `appBar`, `headerRow`, `mobileFooter`, `listToolbar`, `leavePrompt`, `discard`, `panelCrash`, `helpWorld`, `currencyDeletes` |
| ⚙️ Whole-world runs | `optimize`, `optimizeItems` |
| 🔒 Q5 suites | `autoSave`, `savedElsewhere`, `saveShortcut`, `saveErrors`, `scriptSurfaces`, `scriptsTab`, `scriptCheck`, `toolScripts` |
