# List Editor Shell

Status: ready-for-agent
Spec session: list-editor-shell — spec

## Problem Statement

The entity panel's **Traits** tab got a full editor: a search box, a **+** menu, a tree with row buttons, and details that slide in over the list. The entity panel's Placeholders tab still uses the old editor: a bare **+** button, no search, and a side-by-side split that ignores the panel's width. The same old editor runs in the dictionary panel and in both library modals.

The old placeholder editor also opens every row in the full placeholder manager. A Blueprint copy that an entity owns opens as a plain placeholder, so its overrides are hidden and its raw record is editable. Only the World Editor's own Placeholders tab opens the copy editor, because that logic lives inline in the World Editor view.

Every World Editor tab builds its list, search, **+** and detail inline in the World Editor view, in one shared set of branches. Each tab handles search its own way: Placeholders and Dictionary ignore it, Traits matches world traits only. One selection id is shared by every tab.

## Solution

A generic **List Editor** shell owns what every list editor repeats: the toolbar, the switch between the tree and the flat search list, the detail and its footer, clearing a selection the list doesn't hold, and the empty hint. Each list plugs in through an adapter. The shell gives its parts to the host: the World Editor places them in its resizable split and mobile push, and panels and modals wrap them in `ListDetail`, stacked or side by side.

Every World Editor tab except Overview moves onto it, and so do the Traits editors, every placeholder editor, the library dictionary tree, and the Openings toolbar. The placeholder detail logic moves out of the World Editor into one shared router, so a copy opens its copy editor everywhere.

This is a refactor. The only behavior changes are the ones the rulings name. Any other drift an agent finds is recorded in `drift.md` for later review, not fixed or silently kept.

## Rulings

- **Q1** Four placeholder hosts move onto the shell: the entity panel, the dictionary panel, the library entity modal, and the library dictionary modal.
- **Q2** The World Editor's top-level Placeholders and Traits tabs move onto the shell too, so they match the scoped editors.
- **Q3** The shared core is one generic shell with an adapter per list. `EntityTraitsEditor` moves onto it; no parallel placeholder copy of it.
- **Q4** The World Editor's placeholder detail panes (group, owner, copy editor with its footer, manager) are extracted into one shared router. Every host uses it.
- **Q5** Search in a scoped placeholder list shows a flat list of matching rows, through the shared placeholder-aware match (name, chip names, described values).
- **Q6** The entity and dictionary panels use the stacked layout. The library modals stay side by side.
- **Q7** The World Editor holds the entity panel's placeholder selection, as it holds the entity trait selection. A switch to another entity tab and back keeps it; a new entity returns to the list.
- **Q8** Build now. Mirror ticket 05 (the stacked pattern's Design-System entry) is still in progress in another session.
- **Q9** The shell yields list, detail and footer parts. The World Editor puts them in its own resizable split and mobile push, so every tab keeps the same divider. Panels and modals wrap the parts in `ListDetail`.
- **Q10** Every World Editor tab moves onto the shell in this effort, not only Traits and Placeholders.
- **Q11** Top-level Placeholders search matches every placeholder row: world, owned and copies, each under the label its row shows (`Owner › Name`). Folders and owner nodes stay out.
- **Q12** A scoped placeholder list's **+** is one add action, "Add Placeholder to <owner>", named from the search text. Owners can't own groups, so there is no menu.
- **Q13** In the library entity modal, a copy opens the copy editor over the blueprints the card carries. The blueprint is read-only there: no **Edit Blueprint**.
- **Q14** The World Editor also holds the dictionary panel's placeholder selection, one per panel, on the same rule as Q7.
- **Q15** Behavior tests run through the World Editor bench and the rendered library modals. No unit test on the shell's internals.
- **Q16** Panel sub-lists adopt the shell too. The dictionary panel has no entry sub-list (entries live in the tree), so this covers Openings and the library dictionary modal's book tree.
- **Q17** Ticket 01 extracts the shell with the Traits editors. Each other tab and host migrates in its own ticket, and every ticket leaves the gates green.
- **Q18** Pure refactor for the top-level tabs apart from the named rulings. Existing World Editor tests pass unchanged; a changed assertion needs a stated reason. An agent that finds any other behavior drift records it in `drift.md` and keeps the old behavior.
- **Q19** Overview stays out of the shell. It has no list, toolbar or selection.
- **Q20** Openings adopts the toolbar and search only. Its cards stay inline; no list-and-detail split.
- **Q21** Each top-level tab keeps its own selection. Traits → Stats → Traits reopens the trait. This removes the stale-id empty push on mobile.
- **Q22** Top-level Traits search matches owned traits and Links too, each under the label its row shows. Groups and entity nodes stay out. This reopens mirror Q12 on the new evidence of Q11.
- **Q23** The Dictionary tab's search shows a flat list of matching books and entries through the shared match.
- **Q24** The unreachable Stat Updates editor branches and `StatUpdatesManager` are deleted in the stats ticket. The world's `statUpdates` field stays. `drift.md` records the upstream idea (below) for a later ruling.
- **Q25** The drift log lives at `docs-internal/specs/list-editor-shell/drift.md`.
- **Q26** The shell is the **List Editor** (`ListEditor`) in code and in `CONTEXT.md`.
- **Q27** The parts come from a hook, `useListEditor(adapter, selection)`: toolbar, list, detail, footer, `showDetail`, `onBack`. The `ListEditor` component takes `layout: 'stacked' | 'sideBySide'` and wraps those parts in the existing `ListDetail`, toolbar above the scrolled list. `ListDetail` keeps its boolean `stacked` prop unchanged; there is no second `ListDetail`.

## User Stories

1. As an author, I want an entity's Placeholders tab to work like its **Traits** tab, so that I learn one editor.
2. As an author, I want to search an entity's placeholders, so that I can find one in a long list.
3. As an author, I want the search text to name a placeholder I add, so that I can type a name and press **+**.
4. As an author, I want "Add Placeholder to <entity>" on the **+**, so that I can see who gets the new placeholder.
5. As an author, I want a placeholder's details to slide in over the entity's list, so that the list and the details share the panel's width.
6. As an author, I want the open placeholder to stay open when I switch to Profile and back, so that a quick check doesn't lose my place.
7. As an author, I want a Blueprint copy to open its copy editor wherever I select it, so that I edit its overrides and never its raw record.
8. As an author editing a library entity, I want its copies to open the copy editor with the blueprint read-only, so that I can adjust the copy without the world.
9. As an author, I want a dictionary's Placeholders tab to work the same way, so that every owner's list behaves alike.
10. As an author, I want to search the top-level Placeholders tab, so that I can find an owned placeholder or a copy by the name its row shows.
11. As an author, I want the top-level Traits search to find owned traits and Links, so that it matches the Placeholders search.
12. As an author, I want to search the Dictionary tab for books and entries, so that I can find an entry in a large lorebook.
13. As an author, I want each World Editor tab to remember its own selection, so that switching tabs returns me where I was.
14. As an author, I want every other World Editor tab to look and work exactly as before, so that nothing I rely on changes.
15. As an author, I want a search box on Openings, so that I can find one opening among many.
16. As a developer, I want one List Editor for every list, so that lists can't drift apart.
17. As a developer, I want the World Editor view to lose its per-tab list branches, so that the god node shrinks.
18. As a reviewer, I want every behavior drift found during the move in one log, so that I can rule on each later.

## Implementation Decisions

- **The List Editor.** A shell over one list. The caller gives an adapter: the tree to draw with no search, the flat rows to match while a search is typed (with each row's actions), the detail for a selection, an optional detail footer, the **+** slot, the box's placeholder text, whether the list holds an id, and the empty hint. The shell owns the search state, the flat search list, and clearing a selection the list doesn't hold. Selection comes in as props, so a host can hold it.
- **Parts and wrappers.** The shell exposes toolbar, list, detail and footer parts. A `ListDetail` wrapper takes a layout (`stacked` or `sideBySide`) for panels and modals. The World Editor places the parts in its `react-resizable-panels` split and its mobile push, keeping its footer bar, palette bar, Bench and In Play panes outside the shell.
- **Toolbar.** The shell uses the existing `ListSearchToolbar`: a single add action or menu content as a slot, `children` for extras such as the Locations view toggle, `after` for the help button. The `list-add` tour anchor and the find-bar skip stay.
- **Search.** Every list matches through the existing placeholder-aware `matchesListSearch`. A tree's flat list names each row by the label its row shows.
- **Owns-its-slot mode.** A list slot can opt out of the list scroll and the click-to-deselect, for the Locations canvas. The canvas ignores search, as today.
- **Selection.** The World Editor keeps one selection per top-level tab (Q21), plus the entity trait selection, the entity placeholder selection and the dictionary placeholder selection (Q7, Q14). Find, Bench and tour navigation set the target tab's selection.
- **Placeholder detail router.** One component picks the pane for a placeholder selection: group, owner node, copy (with its footer), or manager. Selection stays in row ids with the bare-id fallback. Scoped hosts have no groups or owner nodes, so only the copy and manager branches apply there.
- **Library copies.** The library entity modal reads the card's own `blueprints` so the copy editor can resolve a copy. It reads them only; nothing in this effort writes a card's blueprints, and no world or card shape changes.
- **Openings.** The world and entity Openings panels get the toolbar and a flat match over their cards' text. Each add names its opening from the search text if it has a name field; otherwise the search only filters.
- **Stat Updates (Q24).** Upstream v1.1.14 shipped "Updates": author-defined stat passes, each with a name, a prompt, the stats it may change, and example user and assistant turns. After narration each one would run in parallel on `gametext: <narration>`, return JSON stat changes, and apply them only to its stats. Upstream left the tab commented out and the loop behind `if (false)`. The loop was deleted here in "Fix Lint"; the editor branches stayed. Today the single stat pass, per-stat descriptors and QuickJS stat code cover the need; per-stat specialist passes with their own examples don't exist.
- **Drift log.** `drift.md` has one row per drift: surface, old behavior, where it lives, the ticket that found it, and a proposed ruling. Ticket 01 creates it with the three quirks already found:
  - One `selectedItemId` survives a tab switch, so on mobile a stale id pushes an empty detail (fixed by Q21; logged for the record).
  - A search that excludes the selected stat or location blanks its detail.
  - Dragging a row in the flat search list moves it by raw array index, not by tree order.
- **No export-shape change.** No world, save or card file changes shape.

## Testing Decisions

- A good test drives the real editor as an author does (type in search, press **+**, click a row, press back, switch tabs) and asserts what the author sees or what lands in the world. It never inspects the shell's internals (Q15).
- **World Editor bench** (`renderWorldEditorBench`): every migrated tab's list, search, **+**, detail and footer; per-tab selection; the entity and dictionary panels' Placeholders tabs; copies opening the copy editor.
- **Rendered library modals:** `EntityEditorModal` and `DictionaryEditorModal` Placeholders tabs, the copy editor on carried blueprints, the dictionary book tree.
- Existing World Editor, mirror and library tests pass unchanged through each migration (Q18).
- Prior art: `WorldEditor.fasterAuthoring.test.tsx`, `WorldEditor.ownedTraits.test.tsx`, `WorldEditor.entityPanel.test.tsx`, `WorldEditor.placeholderBlueprints.test.tsx`, `EntityEditorModal.traits.test.tsx`, `EntityEditorModal.placeholders.test.tsx`, `DictionaryEditorModal.placeholders.test.tsx`, `PlaceholderList.test.tsx`.
- Motion is not asserted in jsdom.

## Out of Scope

- The Overview tab (Q19).
- A list-and-detail split for Openings (Q20).
- Removing the world's `statUpdates` field, or reviving specialist stat passes (Q24).
- Fixing any drift the log records beyond the named rulings (Q18).
- A tree that filters in place while searching.
- Writing a library card's blueprints (Q13).

## Further Notes

- **Origin:** investigated and grilled on 2026-09-29, after the Entity Traits Mirror effort. That spec listed the other sub-lists as a later effort; this is it.
- Tickets 07–10 all edit the World Editor view. They are independent in principle; running them one at a time avoids conflicts in the shared checkout.
