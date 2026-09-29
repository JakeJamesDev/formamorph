# List Editor Shell: drift log

Behavior the move onto the List Editor found and did not change (Q18). Each row keeps the old behavior until a ruling says otherwise.

| # | Surface | Old behavior | Where it lives | Found by | Proposed ruling |
|---|---|---|---|---|---|
| 1 | World Editor, mobile | One `selectedItemId` serves every tab and survives a tab switch. On mobile a stale id pushes an empty detail. | `src/views/WorldEditor.tsx` (`selectedItemId` state) | Spec grilling | Fixed by Q21: each tab keeps its own selection. Logged for the record. |
| 2 | World Editor, Stats and Locations tabs | A search that doesn't match the selected stat or location blanks its detail, because the detail reads the selection from the filtered items. | `src/views/WorldEditor.tsx` (`selectedItem` from `filteredItems`) | Spec grilling | Keep the detail while a search is typed; the search filters only the list. |
| 3 | World Editor, flat search list | Dragging a row in the flat search list moves it by its raw array index, not by tree order. | `src/views/WorldEditor.tsx` (`handleRowDragEnd`) | Spec grilling | Turn off drag in the flat search list; reorder in the tree only. |
| 4 | World Editor, Stat Updates | Upstream v1.1.14 shipped author-defined stat passes, each with a name, a prompt, its stats, and example turns. Upstream never turned them on. The editor branches are unreachable and go in the stats ticket (Q24). | The world's `statUpdates` field, still loaded and saved. Ticket 07 deleted `StatUpdatesManager` and its editor branches. | Spec grilling | Decide later whether per-stat specialist passes return. The single stat pass, stat descriptors and QuickJS stat code cover the need today. |
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
- Ticket 06's library modal lists clear a selection whose row is gone, where the old editor kept it and showed an empty detail. Keep: Q36. `holds` accepts every drawn row and the bare id of each placeholder in it.
- Ticket 06 found that a world copy whose blueprint is gone still opens the raw placeholder manager on the tab and in the panels. Only the library entity modal shows the missing-blueprint notice (ticket 06). Not a drift from the move; named for a later ruling.
- Ticket 06's library modal **+** keeps the old "Add Placeholder" name, not Q12's "Add Placeholder to <owner>". The modal is the owner's own editor, and the ticket keeps the existing modal tests unchanged, which name it so.
- Ticket 07's Stats list clears a selection whose stat is gone, where the old list kept it and pushed an empty detail on mobile. Keep: Q36. `holds` accepts every stat.
- Ticket 07's Stats rows read "Select <label>" to a screen reader in the full list too, not only in search. The whole list is the shell's flat list, so #5's ruling (Q32) covers it.
- Ticket 07 keeps #2: a search that leaves the open stat out blanks its detail, and clearing the search brings it back.
- Ticket 08's Entities tab clears a selection whose entity or folder is gone, where the old tab kept it and pushed an empty detail on mobile. Keep: Q36. `holds` accepts every entity and every folder.
- Ticket 08's entity search rows read "Select <label>" to a screen reader, not the raw name. Keep: Q32.
- Ticket 08 found no #2 on the Entities tab: the old detail read the open entity from the full list, so a search never blanked it. The adapter keeps that.
- Ticket 09's Locations tab clears a selection whose location is gone, where the old tab kept it and pushed an empty detail on mobile. Keep: Q36. `holds` accepts every location, the canvas's picks included.
- Ticket 09's location search rows read "Select <label>" to a screen reader, not the raw name. Keep: Q32.
- Ticket 09 keeps #2 in both views: a search that leaves the open location out blanks its detail, on the canvas too, which ignores the search itself. It keeps #3's raw-index drag on search rows (Q29).
- Ticket 11 moved the Openings panels onto the toolbar and found no drift. The world panel's **+** adds to the world, and each entity group keeps its own Add button (Q40).
