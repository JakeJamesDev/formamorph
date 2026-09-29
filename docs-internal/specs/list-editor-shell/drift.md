# List Editor Shell: drift log

Behavior the move onto the List Editor found and did not change (Q18). Each row keeps the old behavior until a ruling says otherwise.

| # | Surface | Old behavior | Where it lives | Found by | Proposed ruling |
|---|---|---|---|---|---|
| 1 | World Editor, mobile | One `selectedItemId` serves every tab and survives a tab switch. On mobile a stale id pushes an empty detail. | `src/views/WorldEditor.tsx` (`selectedItemId` state) | Spec grilling | Fixed by Q21: each tab keeps its own selection. Logged for the record. |
| 2 | World Editor, Stats and Locations tabs | A search that doesn't match the selected stat or location blanks its detail, because the detail reads the selection from the filtered items. | `src/views/WorldEditor.tsx` (`selectedItem` from `filteredItems`) | Spec grilling | Keep the detail while a search is typed; the search filters only the list. |
| 3 | World Editor, flat search list | Dragging a row in the flat search list moves it by its raw array index, not by tree order. | `src/views/WorldEditor.tsx` (`handleRowDragEnd`) | Spec grilling | Turn off drag in the flat search list; reorder in the tree only. |
| 4 | World Editor, Stat Updates | Upstream v1.1.14 shipped author-defined stat passes, each with a name, a prompt, its stats, and example turns. Upstream never turned them on. The editor branches are unreachable and go in the stats ticket (Q24). | `StatUpdatesManager`; the world's `statUpdates` field | Spec grilling | Decide later whether per-stat specialist passes return. The single stat pass, stat descriptors and QuickJS stat code cover the need today. |

## 📌 Notes

- Ticket 01 moved the Traits editors onto the shell and found no new drift.
