# Entity Traits Mirror

Status: ready-for-agent
Spec session: entity-traits-mirror — spec

## Problem Statement

An author edits an entity's own traits in the World Editor through a bare list. The entity panel's **Traits** tab shows the entity's traits and groups as plain buttons, with **Add Trait** and **Add Group** below. Clicking a row, or adding one, jumps to the **Traits** tab and selects it there. The author leaves the entity they were editing to edit one of its traits.

The list has none of the tools the author has on every World Editor tab: no search, no **+** menu, no row buttons (duplicate, delete), no reorder. The library entity editor has a full trait editor for one entity, but it uses its own **Add Trait** / **Add Group** buttons and has no search either.

The World Editor's list toolbar (search box, **+**, the rule that the search text names a new item) lives inline in the World Editor view. No other list can use it, so entity and dictionary sub-lists (Placeholders, Openings, dictionary entries) have no search at all.

## Solution

The entity panel's **Traits** tab becomes a mirror of the **Traits** tab, limited to that entity. It stays Advanced only.

- It opens on the entity's trait list: the same tree, rows and row buttons as the **Traits** tab.
- Above the list sits the World Editor's list toolbar: a search box and a **+** menu with **Add Trait to <entity>** and **Add Group to <entity>**.
- There is no split pane. Selecting a trait or group slides its details in over the list, the way the **Traits** tab works on mobile. A back row returns to the list.

The toolbar becomes a shared widget. The World Editor's own toolbar moves onto it, the mirror uses it, and the library entity editor's **Traits** tab uses it in place of its buttons. Later efforts can give it to the other sub-lists.

The mirror and the library editor's **Traits** tab become one entity traits editor, fed a Trait Store and a layout: stacked in the World Editor, side by side in the library.

## Rulings

- **Q1** The library entity editor's **Traits** tab keeps its side-by-side layout. The shared editor takes a layout choice.
- **Q2** On the **Traits** tab, a selected entity node's panel shows the entity's name and **Open Entity** only. Its small trait list goes.
- **Q3** The mirror reorders and nests inside the entity only. Cross-owner drags and drag-to-link stay on the **Traits** tab.
- **Q4** The mirror's **+** menu has no **Link Trait…** row. **Link To…** on the Original covers linking.
- **Q5** While a search is typed, the mirror shows a flat list of matches, as the World Editor tabs do. No tree filters in place.
- **Q6** The World Editor's toolbar moves onto the extracted widget in this effort. One source.
- **Q7** The library entity editor's **Traits** tab gets the toolbar (search and **+** menu) in place of its buttons.
- **Q8** On desktop the mirror fills the entity panel's height. The toolbar stays in place; the list and the details scroll inside.
- **Q9** Changing the selected entity returns the mirror to its list. Switching entity tabs and back keeps the open trait. The World Editor holds the mirror's selected id, as it holds `entityTab` and `traitTab`, since Radix tabs unmount hidden content. The shared editor takes selection as props. The library editor keeps its own selection and still resets on a tab switch, as today.
- **Q10** The mirror's details have no link to the same trait on the **Traits** tab.
- **Q11** On mobile the mirror's details are a second push inside the pushed entity panel, with its own back row.
- **Q12** The **Traits** tab's search keeps matching world traits only. Owned traits stay out of it.
- **Q13** The mirror's search matches the entity's traits and Links. Groups are not listed, as on the **Traits** tab. Matching Links is new to the mirror; the **Traits** tab's search matches world traits only.
- **Q14** After **+** adds in the mirror, the search text names the new item, the box clears, and the new item's details slide in.
- **Q15** The mirror's toolbar has no **?** help button.
- **Q16** The one-entity store separates "the root is one entity" from "there is no world". In the mirror, the requirement picker offers personas and the pin rows read the world, as on the **Traits** tab. Only the library store sets `offWorld` and a null `pinWorld`.
- **Q17** The toolbar widget takes its **+** menu content as a slot, not as a list of add actions. The **Traits** tab's drill-in menu and its conditional rows compose inside that slot. A plain **+** button stays a single add action.
- **Q18** The entity panel's host stops scrolling for the entity **Traits** and Placeholders tabs and gives them a flex column with the pane's real height. Other detail panels keep the pane's `ScrollArea`. The Placeholders tab's viewport-based fallback height goes in this effort.
- **Q19** The migrated toolbar keeps `data-tour-anchor="list-add"` on the **+** and `data-editor-find-skip` on the search box. The authoring tour and the find bar read them.
- **Q20** On mobile the nested stacked layout needs the same definite height as Q18. The pushed entity panel gives its **Traits** tab a flex column too.
- **Q21** The widget clears the search box after every add, menu rows included. **Add Templates Group** and **Add Custom Persona** still ignore the search text as a name; they no longer leave a stale filter hiding the new row.
- **Q22** The dictionary panel's Placeholders tab fills the pane through the same per-tab host switch as the entity tabs. The viewport-based fallback height is shared by both, so it goes entirely rather than staying for one of them.
- **Q23** `ListDetail`'s stacked option and its test land in ticket 03 with the shared editor's layout prop, so the prop is never inert. Ticket 04 uses it.
- **Q24** The flat search lists each Link's own row, trait links and group links alike, matched by the name the row shows: the Original's live name in a world, the stored name standalone. Rows inside a linked group's subtree are the Original's rows and stay out, as groups do.
- **Q25** The shared editor's **+** reads "Add to <entity name>" through the entity's placeholders, and its box reads "Search or add new traits", as on the **Traits** tab. The store's "root is one entity" field is named `entityRoot`; the library store and ticket 04's world store both set it.
- **Q26** In the one-entity tree, drops land relative to Link rows: a drag past a Link reorders around it, and own items keep an order that counts the Links between them, as on the **Traits** tab. Nesting into a linked group stays blocked. The library editor shares the path and gets the same behavior.
- **Q27** The mirror hides the "Owned by <entity>" line on a trait's Details; the entity panel's heading already names the entity. The owner still drives everything else. The library editor keeps its line and its Entity-tab switch.
- **Q28** In a one-entity tree a Link's own row drags among the entity's items, mirror and library editor alike. A linked group's inner rows stay fixed.
- **Q29** On a trait's Details inside a one-entity editor, a Requires chip whose target the entity holds is a button that selects it. A chip whose target is outside the entity (a world trait, a persona) renders as a plain non-interactive chip: same look, no button role, no hover. Nothing navigates to the **Traits** tab (Q10).
- **Q30** A stacked details panel nested inside a panel takes the host panel's surface color, never the page background. The top-level mobile push over the page keeps the page color. The dashed Linked-from box stays.
- **Q31** In the **This Link** section, the pinned-value rows share a three-column grid: label, arrow and select. The label and arrow columns size to their longest entry, labels stay left-aligned, and every arrow and every select start on one line. The single pin row uses the same grid.
- **Q32** On the **Traits** tab, a world original's **Link To…** moves from the Details header to a frozen footer, like the editor's **Save** bar: the detail pane's own bar outside the detail scroll, in the side-by-side card and in `ListDetail`'s push (`detailFooter`), not a slot inside the trait or group panel. It shows on every panel tab (Details, Stats, Pins) and its flyout opens upward. The Linked-from line and **This Link** stay on Details. Ticket 06.
- **Q33** A pushed detail's back control is an icon-only arrow in the detail panel's own header, never a row of its own. `ListDetail` supplies the button; the panel places it. Its accessible name and tooltip read "Back to <list name>". Side by side shows no arrow, as today. Ticket 07.
- **Q34** On a panel with a tab strip, the arrow leads the strip: the shared `PanelTabsList` takes a leading slot. On the Dictionary entry the arrow leads the tab strip, and the palette bar stays above it. Ticket 07.
- **Q35** On a panel with no tab strip (the placeholder detail, the entity group detail), the arrow sits at the left of the panel's first row. No new row. Ticket 07.
- **Q36** Every `ListDetail` surface takes the inline arrow, the mobile push included, so the pattern stays one pattern. On mobile the outer push's arrow leads the entity tab strip, and the trait detail's arrow leads the trait tab strip. Ticket 07.
- **Q37** On mobile the placeholder chip strip starts collapsed until the user expands it. The existing remembered choice then applies on that device. Ticket 07.
- **Test seams** Behavior is tested through the World Editor bench and the rendered library entity editor only. No unit seam on the widget or its search. `ListDetail`'s stacked option is tested in its own `list-detail.test.tsx`, as its mobile push is.

## User Stories

1. As an author, I want to edit an entity's traits without leaving the entity, so that I keep my place while I build a character.
2. As an author, I want the entity's **Traits** tab to show its traits in the same tree as the **Traits** tab, so that I don't learn a second list.
3. As an author, I want each row in the mirror to have the same buttons as on the **Traits** tab, so that I can duplicate or delete a trait where I see it.
4. As an author, I want to select a trait in the mirror and see its details slide in, so that the list and the details share the panel's width.
5. As an author, I want a back arrow in a trait's details header, so that I can return to the entity's list in one click without losing a row.
6. As an author, I want a **+** menu in the mirror with **Add Trait to Mira** and **Add Group to Mira**, so that I can see which entity gets the new item.
7. As an author, I want the search text to name a trait I add from the mirror, so that I can type a name and press **+**, as on every World Editor tab.
8. As an author, I want a new trait's details to open right after I add it, so that I can fill it in at once.
9. As an author, I want to search the entity's traits and Links, so that I can find one in a long list.
10. As an author, I want matching rows as a flat list while I search, so that search works the same as on the **Traits** tab.
11. As an author, I want a "no traits match" line when nothing matches, so that I know the search ran.
12. As an author, I want an empty entity to show a hint to add its first trait, so that the empty tab tells me what to do.
13. As an author, I want to reorder and nest the entity's traits in the mirror, so that I can arrange them without leaving the entity.
14. As an author, I want Links to show in the mirror where they sit in the entity's tree, so that the mirror matches the entity's node on the **Traits** tab.
15. As an author, I want selecting a Link in the mirror to show its Linked-from line and **This Link**, so that I can set the link's own values here.
16. As an author, I want the mirror's toolbar to stay in place while its list scrolls, so that search and **+** are always in reach.
17. As an author, I want a trait's details to scroll inside the panel, so that long details don't push the toolbar away.
18. As an author, I want the mirror to return to its list when I select another entity, so that I never see one entity's trait under another's name.
19. As an author, I want the open trait to stay open when I switch to Profile and back, so that a quick check elsewhere doesn't lose my place.
20. As an author on mobile, I want a trait's details to push in over the mirror with their own back arrow, so that each arrow returns one level.
21. As an author, I want reduced motion to skip the slide, so that the mirror respects my system setting.
22. As an author in Basic mode, I want the entity's **Traits** tab to stay hidden, so that Basic stays simple.
23. As an author, I want the **Traits** tab's entity node panel to show the entity's name and **Open Entity**, so that it doesn't repeat the tree beside it.
24. As an author, I want the World Editor's toolbar to work exactly as before after the move, so that nothing I rely on changes.
25. As an author, I want the **Traits** tab's search to keep finding world traits only, so that its results don't change.
26. As an author editing a library entity, I want the same search box and **+** menu on its **Traits** tab, so that both entity editors work the same way.
27. As an author editing a library entity, I want its **Traits** tab to keep its list and details side by side, so that the wide window stays useful.
28. As an author editing a library entity, I want the search text to name a trait I add, so that adding works as it does in the World Editor.
29. As a developer, I want one toolbar widget for every list, so that entity and dictionary sub-lists can get search later without copying code.
30. As a developer, I want one entity traits editor fed a Trait Store and a layout, so that the World Editor and library editors can't drift apart.
31. As a developer, I want the World Editor view to shrink when its toolbar moves out, so that the god node loses a responsibility.

## Implementation Decisions

- **List toolbar widget.** A shared widget owns the search term, the search box, the **+** button or **+** menu, and the name-from-search rule. The caller gives it either one add action (label, icon, and a handler that receives the trimmed search text) or menu content as a slot (Q17), plus the placeholder text and any extra toolbar content (the Locations view toggle, the help button). A menu row calls back with the trimmed search text and the widget clears the term. It keeps the tour anchor and the find-bar skip attribute (Q19). It is built on the existing `ListToolbar` and `ListAddButton`.
- **Search matching.** The placeholder-aware match the World Editor uses today (row label, the names behind its chips, and their described values) moves out with the widget, so every list matches the same way. The World Editor tabs keep their current results (Q12).
- **Flat results.** The World Editor's flat search list stays the pattern. Its remove and duplicate actions come from the caller, so an owner-scoped list can pass the entity's own handlers.
- **Stacked `ListDetail`.** `ListDetail` gains a stacked option that uses its mobile push layout at every width. It lands with ticket 03 (Q23); the mirror uses it. The slide and its reduced-motion rule are the ones `ListDetail` already has. Its test lives in `list-detail.test.tsx`.
- **Filling the pane.** The entity panel's **Traits** tab fills the pane's height (Q8). The other entity tabs keep their natural height. Today the entity panel sits in the pane's `ScrollArea` at natural height, and the stacked layout's absolute panels need a definite height. Per Q18 the host switches per tab: the entity **Traits** and Placeholders tabs get a flex column at the pane's real height, and the Placeholders fallback height is removed. On mobile the pushed entity panel does the same (Q20).
- **Entity traits editor.** Landed in ticket 03 as `EntityTraitsEditor`: it takes `store`, `layout` (`sideBySide` or `stacked`), `selectedId`, `onSelect`, an optional `onOpenEntity`, and `emptyHint`. The World Editor holds the mirror's selection; the library editor holds its own (Q9). The editor owns the details tab. It clears any selection the current entity does not hold (not one of its traits, groups or Links), on mount included, and resets the details tab with it; the World Editor keys the entity panel by entity id, so a host keeps one `selectedId` without resetting it itself.
- **Names from ticket 03.** The store's one-entity field is `entityRoot` (`bearer`, `world`); the tree builder is `entityRootTraitTree`; `linkRowRemovable` is the one rule for whether a Link row offers **Remove Link**; `ListDetail` takes `stacked`.
- **Names from ticket 04.** One-entity drops go through `getEntityRootDropProjection` and `applyEntityRootDrop`; `TraitTree` takes that path whenever the store has an `entityRoot` (Q26). `TraitManager` takes `ownerLine`, passed through the shared editor, off in the mirror (Q27).
- **Gates in a one-entity tree.** An own row's gate reads as the root entity's, not the player's. Ticket 03 left own items out of `ownerOf`, so a gated trait lost its lock count in the mirror and in the library editor; ticket 04 fixed both.
- **World Trait Store for one entity.** A Trait Store over one world entity: its traits and groups fill the tree's root, writes land on it through the world's entity edit, and its Links read their Originals live from the world. Gates read the whole world, the requirement picker offers personas, and the pin rows read the world's `pinWorld` (Q16). The store's "root is one entity" flag is separate from `offWorld`. The library store stays as it is.
- **+ menu rows.** **Add Trait to <entity name>** and **Add Group to <entity name>**, with the name drawn through its placeholders. Group adds are Advanced only, which the tab already is.
- **Mirror drags.** Reorder and nest within the entity only (Q3). The tree's cross-owner drops and drop-to-link do not apply in the mirror.
- **Node panel.** The **Traits** tab's entity node panel drops its trait list (Q2). The old bare list component is removed.
- **Library editor.** Its **Traits** tab uses the shared editor side by side, with the toolbar in place of its **Add Trait** / **Add Group** buttons (Q1, Q7). Its empty hint stays its own, since it has no world **+** to point at.
- **No export-shape change.** Nothing here changes a world, save or card file.
- **Design system.** The stacked list-and-detail inside an entity panel is a new visual pattern. It needs a Design-System entry and a showcase reference once approved.

## Testing Decisions

- A good test drives the real editor as an author would (open a tab, type in search, press **+**, click a row, press back) and asserts what the author sees or what lands in the world. It never inspects the toolbar widget's or the search's internals.
- **World Editor bench** (`renderWorldEditorBench`): the migrated toolbar on every tab (search results, name-from-search, **+** menus); the mirror's list, search, **+** menu, slide to details and back, selection reset on entity change, reorder inside the entity, Link details; the node panel's reduced content; Basic hides the tab.
- **Library entity editor** (rendered `EntityEditorModal`): the **Traits** tab's toolbar, name-from-search, and side-by-side layout.
- Existing World Editor toolbar tests must pass unchanged through the migration. A changed assertion there needs a stated reason. The authoring tour tests cover the kept `list-add` anchor (Q19).
- Prior art: `WorldEditor.fasterAuthoring.test.tsx` (+ menu and flyouts), `WorldEditor.ownedTraits.test.tsx` (entity nodes and owned traits), `WorldEditor.entityPanel.test.tsx` (entity tabs), `EntityEditorModal.traits.test.tsx` (library traits).
- Motion is not asserted in jsdom. A slide claim needs Playwright frame sampling if one is made.

## Out of Scope

- The toolbar on other sub-lists: entity Placeholders and Openings, dictionary entries, the library dictionary editor. They adopt the widget in a later effort.
- A tree that filters in place while searching.
- Owned traits in the **Traits** tab's search results (Q12).
- **Link Trait…** in the mirror's **+** menu (Q4).
- Cross-owner drags and drag-to-link from the mirror (Q3).
- A help button on the mirror's toolbar (Q15).
- A link from the mirror's details to the same trait on the **Traits** tab (Q10).

## Further Notes

- The World Editor's Dictionary and Placeholders tabs ignore the search today; their box only names new items. The migration keeps that.
- **Add Templates Group** does not take the search text as its name. The migration keeps that. The box now clears after it (Q21).
- The mirror nests a push inside the mobile entity push (Q11). Nothing else in the editor goes three levels deep.
