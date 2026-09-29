# List Editor Shell: drift log

Behavior the move onto the List Editor found and did not change (Q18). Each row keeps the old behavior until a ruling says otherwise.

| # | Surface | Old behavior | Where it lives | Found by | Proposed ruling |
|---|---|---|---|---|---|
| 1 | World Editor, mobile | One `selectedItemId` serves every tab and survives a tab switch. On mobile a stale id pushes an empty detail. | `src/views/WorldEditor.tsx` (`selectedItemId` state) | Spec grilling | Fixed by Q21: each tab keeps its own selection. Logged for the record. |
| 2 | World Editor, Stats and Locations tabs | A search that doesn't match the selected stat or location blanks its detail, because the detail reads the selection from the filtered items. | `src/views/WorldEditor.tsx` (`selectedItem` from `filteredItems`) | Spec grilling | Keep the detail while a search is typed; the search filters only the list. |
| 3 | World Editor, flat search list | Dragging a row in the flat search list moves it by its raw array index, not by tree order. | `src/views/WorldEditor.tsx` (`handleRowDragEnd`) | Spec grilling | Turn off drag in the flat search list; reorder in the tree only. |
| 4 | World Editor, Stat Updates | Upstream v1.1.14 shipped author-defined stat passes, each with a name, a prompt, its stats, and example turns. Upstream never turned them on. The editor branches are unreachable and go in the stats ticket (Q24). | `StatUpdatesManager`; the world's `statUpdates` field | Spec grilling | Decide later whether per-stat specialist passes return. The single stat pass, stat descriptors and QuickJS stat code cover the need today. |
| 5 | World Editor, Traits search rows | A search row's screen-reader name read "Select <raw name>", so a name holding a chip read its stored token. The List Editor's rows read "Select <label>", as the entity Traits editor has since ticket 01. | `src/components/listEditorHooks.tsx` (`selectionLabel`) | Ticket 03 | Keep the label: the raw token was never a readable name. |
| 6 | World Editor, Traits tab | Deleting the open trait from the tree kept its id selected, so on mobile the push showed an empty detail. The List Editor clears a selection its list doesn't hold. | `src/components/listEditorHooks.tsx` (stale-selection clear) | Ticket 03 | Keep the clear: it is the shell's rule (spec Solution) and the in-tab half of #1. |
| 7 | World Editor, library add | An entity or book added from the library selected its id on whichever tab was active. It now selects on the Entities or Dictionary tab. | `src/views/WorldEditor.tsx` (`addEntityToWorld`, `addBookToWorld`) | Ticket 03 | Keep: each tab holds its own selection (Q21), and the add opens from that tab. |
| 8 | World Editor, Placeholders tab | A selection whose row was gone (a nested row promoted, a shared reference removed, its entity deleted on the Entities tab) stayed selected, so on mobile the push showed an empty detail. The List Editor clears a selection the tab can't resolve. | `src/managers/useWorldPlaceholdersAdapter.tsx` (`holds`) | Ticket 04 | Keep: Q36. `holds` accepts what the detail router resolves (a row, a folder, an owner, a bare placeholder id), so nothing it opened before is cleared. |
| 9 | Entity and dictionary panels, Placeholders tab | Duplicate on a shared row (a world placeholder drawn under the owner's row) made a world copy and opened it in the panel. The panel's list never shows that copy, so the List Editor can't hold it. | `src/managers/ScopedPlaceholdersSection.tsx` (`holds`) | Ticket 05 | Ruled: Q39. The copy opens on the top-level Placeholders tab, as Edit Blueprint does (Q37), and the panel keeps its own selection. |

## 📌 Notes

- Ticket 01 moved the Traits editors onto the shell and found no new drift.
- Ticket 03 kept #3's raw-index drag on world trait search rows (Q29). Owned trait and Link rows have no grip, since they had no search row before.
- Ticket 04's placeholder search rows have no grip: the tree's drop nests and moves records between lists, which a flat list can't express.
- Ticket 05's panel lists clear a selection whose row is gone, as #8 does on the tab. Keep: Q36. `holds` accepts every row the owner's tree draws and the bare id of each placeholder in it, so a shared row's link still opens its original in the panel.
