# 08: WorldEditor Batch 2

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: Repeats a set pattern; judgment is limited to following it and its proof recipe.

Parent: [Test Sweep spec](../spec.md)

## What to build

The first batch the pilot's note assigns moves off the full view mount (Q7), using the pilot's pattern and helpers.

Pause: features pause for this step (Q17-Q20). The spec session confirms that in-flight work has landed before this ticket starts.

Rulings: Q7, Q22, Q23.

## Acceptance criteria

- [x] Only tests the note assigned to this batch moved. The 15 files of "Ticket 08: Media, Stats and Traits" are the only view files touched; 183 tests, none deleted, none added to them. Two reviewers compared every test title and every `expect` line, old against new: all present once, none changed.
- [x] Time before and after is recorded in the ticket. See Results.
- [x] Q5 tests keep their mutation kills; other tests show held coverage and one reinstated bug turning red. 22 pairs, each exit 0 with 0 lost lines and branches. Reinstated bugs are under Results.

## Results

**Group:** the Media, Stats and Traits tabs, 15 view files. The view files kept the cases only the editor wiring makes pass (cross-tab navigation, the shared search, mobile push, mode switch, Find and Bench landings, history reveal, entity-panel cases on the Entities tab). Tests per tab: 183 (201 with `it.each` rows); 159 rows moved, 42 stayed on the view mount.

| 201 test rows, 3 alternating runs of each layout, medians | Before | After |
|---|---:|---:|
| Test bodies | 141.2 s | 69.2 s |
| Wall time | 22.6 s | 18.2 s |
| Files | 15 | 20 |
| Test rows on the view mount | 201 | 42 |

Peer sessions were working during the runs, so read the wall times as a ranking.

| New file | Module it exercises |
|---|---|
| `src/managers/useWorldStatsAdapter.test.tsx`, `useWorldStatsAdapter.blueprints.test.tsx` | `useWorldStatsAdapter` |
| `src/managers/StatManager.panelTabs.test.tsx` | `StatManager` |
| `src/managers/WorldStatTree.test.tsx` | `WorldStatTree` |
| `src/managers/useWorldTraitsAdapter.test.tsx` | `useWorldTraitsAdapter` |
| `src/managers/TraitManager.panelTabs.test.tsx`, `.requires.test.tsx`, `.owned.test.tsx` | `TraitManager` |
| `src/managers/TraitTree.gateMarks.test.tsx`, `.owned.test.tsx`, `.systemNodes.test.tsx` | `TraitTree` |
| `src/managers/TraitsAddMenu.test.tsx`, `TraitLinkPanel.overrides.test.tsx` | `TraitsAddMenu`, `TraitLinkPanel` |
| `src/managers/useWorldMediaEditor.test.tsx` | `useWorldMediaEditor` |
| `src/managers/MediaImagePanel.test.tsx`, `.mapBackground.test.tsx` | `MediaImagePanel` |
| `src/managers/MediaPanels.test.tsx` | `MediaPanels` |
| `src/views/WorldEditor.{statsTab,traitsTab,mediaTab}.test.tsx` | the view, one file per tab |

**Helpers:** `src/test/panelBench.tsx` gained the parts host `renderListParts` (the parts host for `useWorldMediaEditor`), a shared search for the adapter and the toolbar, `withEditorProviders` (the rename, preview-rolls and chip-insert providers the view adds) and a copy of `openTraitFieldsTab`. `renderListTab` now lays the parts out through `ListDetail` like the view, so the Items suites mount through the same path; they pass (103 tests across the Items and new view files). `statsTabBench`, `traitsTabBench` and `mediaTabBench` hold each tab's panel state. `worldEditorBench` is unchanged. Ticket 09 edits the same helper; no ticket 09 session was running when this landed.

**Moves that needed the view:** the Media Go to, the chip clicks that open another tab's row, and every test that opens the Entities tab stayed on the view mount, because the bench leaves navigation idle and a no-op would rig them. Undo in the moved Media tests runs through `history().undo()`; the chord and the reveal that returns to the tab stayed in the view.

**Kept protection:** pairs for the view (`WorldEditor.tsx`); `useWorldStatsAdapter`, `StatManager`, `WorldStatTree`, `StatGroupManager`, `statListAdapter`; `useWorldTraitsAdapter`, `TraitManager`, `TraitTree`, `TraitLinkPanel`, `TraitsAddMenu`; `useWorldMediaEditor`, `MediaImagePanel`, `MediaPanels`, `MediaGallery`, `MediaHeader`; and under Q50 the Q5 modules the moved tests drive: `blueprints.ts`, `scripts.ts`, `statCodeTemplates.ts`, `ScriptBox.tsx`, `GameDataContext.tsx`, `version.ts`. A panel pair's after list holds the panel's new files plus the view file of that tab, because the view tests that stayed still run and still cover the panel. Counted by the panel files alone, 12 pairs showed lost lines that only those staying tests hold. One loss was real and is below.

**Reinstated bugs, each turning a moved test red and then restored:**
- `useWorldStatsAdapter.tsx`: a new stat's `order` set to `0` turned "adds a stat named from the search box and opens it" red.
- `blueprints.ts` (Q50): `withOverride` storing `value` as the Blueprint's value turned "writes an edit on that link only, and Reset to Blueprint in the footer drops it, in Basic too" red.
- `blueprints.ts` (the added test): removing the early return in `withEffectiveCopies` turned "hands back the same list when it holds no copy" red.

**A Q5 line held by a new test (spec session ruled option a):** `blueprints.ts` line 308, the early return of `withEffectiveCopies`, was reached only by old view mounts. `src/lib/blueprints.test.ts` gained two tests on that function. No product code changed.

**Q5 modules under test:** none of the new panel files has a Q5 module under test. The three view files still credit `WorldEditor.tsx`, a Q5 module, and the kept tests are byte-identical. The pair for it holds coverage, as in the pilot; a mutation run of `WorldEditor.tsx` was not made (about 1174 mutants).

## Landed

**Not verified:** a mutation run on `WorldEditor.tsx` (Q23 for a Q5 view module; the pilot made none either, at about 1174 mutants and a projected 95 hours).

**For you:** nothing; no product code changed.

Two moves the reviewers flagged as arguable, left in the view: the Media "frames the empty slot from the add tile" test, and the Requires chip tests that open another tab's row. Both touch the view's navigation or reveal.
