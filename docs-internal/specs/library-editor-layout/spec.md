# Library Editor Layout

Status: ready-for-agent
Spec session: Persona

## Problem Statement

The main menu has two library editors: one for an entity and one for a dictionary. They do not look like the same product.

- The entity editor is 800px wide. The dictionary editor is 1100px wide.
- The entity editor puts five tabs in one strip: Overview, Profile, Descriptions, Openings, Placeholders. The strip fills a mobile row, and the Persona work adds more to this editor.
- The entity editor's Overview tab holds one field, Tags. A whole tab for one field wastes a click.
- The Placeholders tab is a two-pane editor. At 800px each pane gets 400px, and the value rows are cramped.
- The dictionary editor showed two Placeholders surfaces. One was the Placeholders tab. The other was a section under the book's name, and it read the last loaded world's list. The section is already gone from the library editor. The cause is still there: the app-wide world placeholder store reaches into a library modal.
- The dictionary editor's tree has a node for the book itself. A library dictionary is always one book, so the node only repeats what Overview is for. The book's Name and Description are in the tree node, and its tags and cover are in Overview.
- The library entry tree labels placeholder chips from the last loaded world's placeholders, not from the book's own.
- In the World Editor, the dictionary book panel shows its placeholder editor in a fixed box under the form. The entity panel gives the same editor a full tab.

## Solution

Both library editors get one size and one tab grammar.

- Both are 95% of the viewport wide, to a maximum of 1400px.
- The entity editor has two tabs: **Entity** and **Placeholders**. The Entity tab has Tags in a left column. On the right it has the Profile, Descriptions, and Openings sub-tabs, which are the same fields the World Editor shows.
- The dictionary editor keeps three tabs: **Overview**, **Dictionary**, and **Placeholders**. Overview holds everything about the book: tags, cover, Name, Description, and Enabled. The Dictionary tab shows entries only.
- Form fields keep a readable width. The Placeholders tab uses the full width.
- Each library editor reads only its own placeholders.
- In the World Editor, the dictionary book panel gets **Details** and **Placeholders** tabs.

## User Stories

1. As an author, I want both library editors to be the same width, so that they feel like one product.
2. As an author on a large screen, I want the editors to stop at 1400px, so that they do not span the whole monitor.
3. As an author, I want form fields to keep a readable width in a wide editor, so that short fields do not stretch and long text stays easy to read.
4. As an author, I want the Placeholders tab to use the full width, so that the list and the selected placeholder both have room.
5. As an author, I want the entity editor to have two tabs, so that the strip is short and clear.
6. As an author, I want the entity's Tags beside its fields, so that I do not open a tab for one field.
7. As an author, I want Tags to stay visible on Profile, Descriptions, and Openings, so that the layout does not move when I change sub-tabs.
8. As an author, I want Profile, Descriptions, and Openings as a strip at the top of the Entity tab, so that they read as parts of the entity.
9. As an author, I want the library entity editor to show the same fields as the World Editor's entity panel, so that I learn them once.
10. As an author on mobile, I want Tags at the top of the Profile sub-tab only, so that Descriptions and Openings keep the full height.
11. As an author on mobile, I want the two-tab strip to fit one row, so that the header stays small.
12. As an author, I want the entity editor to open on the Entity tab and the Profile sub-tab, so that I land on the name.
13. As an author, I want search results and findings to open the correct tab and sub-tab, so that a jump to a field still lands on it.
14. As an author, I want one Placeholders surface per library editor, so that nothing looks like a bug.
15. As an author, I want a library dictionary's Name, Description, and Enabled on Overview, so that everything about the book is in one place.
16. As an author, I want to rename a library book on Overview with no question asked, so that the rename is one edit and no world changes.
17. As an author, I want the library entry tree to show entries only, so that the tree is a list of what I write.
18. As an author, I want a + button at the top of the entry list, in the same position and style as the World Editor's lists, so that adding an entry is familiar.
19. As an author, I want the dictionary editor to open on the Dictionary tab with the first entry selected, so that I land on content.
20. As an author with an empty book, I want a hint and the + button, so that I know how to start.
21. As an author, I want entry names and keywords that hold a placeholder chip to show the book's own placeholder name, so that the tree matches the Placeholders tab.
22. As an author, I want a placeholder I create from an entry field in the library to go to the book, so that no world changes behind my back.
23. As an author, I want the dictionary Overview to use two columns on a wide screen, so that tags and cover sit beside the book's fields.
24. As an author in the World Editor, I want the dictionary book panel to have Details and Placeholders tabs, so that the placeholder editor fills the panel as it does for an entity.
25. As an author in the World Editor, I want the book panel's Placeholders tab in Advanced mode only, so that Simple mode stays simple.
26. As an author in the World Editor, I want the dictionary tree to keep its book nodes, so that a world with many books still works.
27. As an author in the World Editor, I want the entity panel unchanged, so that my habits hold.
28. As a developer, I want both entity hosts to render their sub-tabs from one list, so that the two never drift.
29. As a developer, I want the dev router to reach each tab and sub-tab of both library editors in one call, so that UI checks stay fast.
30. As a developer, I want a guard that fails when the editor tabs and the dev-router ledger disagree, so that a new tab cannot be unreachable.
31. As a developer, I want a library modal to be unable to read the world placeholder store, so that this class of bug cannot return.

## Implementation Decisions

### Size

- Both library editor modals use 95vw with a 1400px maximum. Height stays 85dvh.
- A field-column cap applies to form content: the entity sub-tabs, the dictionary entry panel, and the dictionary Overview fields. The build sets the value near 800px, which is the width the fields have today. Capped content sits at the left of its pane.
- The Placeholders tab has no cap.
- The shared list-detail split stays 50/50. A fixed tree width is out of scope.

### Entity editor

- The top strip is Entity, then Placeholders. The Overview tab is removed.
- The Entity tab is a two-column layout at `sm` and up: a Tags column on the left, then the sub-tab strip and its fields on the right. The Tags column shows on all three sub-tabs.
- Below `sm`, the layout is one column. Tags render at the top of the Profile sub-tab and nowhere else.
- The sub-tab strip uses the shared panel tab strip, the same one the World Editor entity panel uses, and renders from the shared entity panel tab list. The library editor stays outside Simple and Advanced mode and shows every sub-tab.
- The library editor mounts the same Profile, Descriptions, and Openings field components as the World Editor. It passes no layout override that the wider pane makes unnecessary.
- The Placeholders sub-tab entry of the shared list is a top tab in the library editor, not a sub-tab. The editor tab list states this once, so both hosts still derive from one source.
- Field-to-tab lookup returns a top tab plus a sub-tab for the library editor. Find, search and replace, and findings use it to focus a field.

### Dictionary editor

- The top strip stays Overview, Dictionary, Placeholders.
- Overview holds Tags, Cover Image, Name, Description, and Enabled. At `sm` and up it uses two columns: Tags and cover on the left, the three fields on the right. The Name field keeps the rename wiring it shares with the World Editor's book panel. The offer rewrites stat code only, and only the World Editor mounts its provider. A library book has no stat code, so the library editor mounts no provider, and its boundary clears the World Editor's provider when the modal opens from there. The field asks nothing in a library editor from either host.
- The book panel component stays the World Editor's. The library editor no longer mounts it. The `inWorld` prop from the guard fix goes away if no host needs it.
- The entry tree takes a mode that hides the book row and shows its entries at the top level. Entry order, drag, duplicate, and delete do not change.
- A + icon button sits at the top of the entry list, with the size, style, and position of the World Editor's list add button. The two hosts share the button row where that is practical. A search field is out of scope.
- The modal opens on the Dictionary tab with the first entry selected. An empty book selects nothing and shows a hint.
- The entry tab's Details and Matching strip does not change.

### One placeholder store per library editor

- Each library modal provides its own placeholder store to its whole body, not only to the Placeholders tab. The tree, the chip fields, and the palette all read the book's or the entity's own pool.
- The store must keep its identity across a keystroke in an entry or a field. Today the carried pool is a new array on each change when the item carries shared placeholders. The build memoizes the pool by its two source lists before it widens the provider. Without this, every chip field rebuilds its vocabulary on each keystroke.
- The modal's store has no world lists, so no scoped section can bind inside it.

### No world behind a library editor

- The main menu mounts both library modals inside the app-wide GameData provider, so an optional GameData read inside a modal returns the last loaded world. User stories 22 and 31 cover every such read, not only the placeholder store.
- The World Editor also mounts both library modals, under its stat-code rename provider. A book rename in a library modal opened from there queues an offer on the world's provider, and the offer's action writes the world's stats. The rename offer reads its own context, not GameData.
- One boundary component wraps each library modal's body. It clears every context that reaches a world: GameData and the rename offer today. A new world-reaching context joins the same boundary.
- Each library modal puts a null GameData override around its body. Every optional GameData read inside then returns nothing, and a new widget gets the same result with no work.
- A library item has no traits, locations, or stats, so a placeholder pin in a library editor offers no trait, location, or stat target. Pin data the item already carries stays as it is: the editor does not strip it, and it does not offer new targets.
- One test per modal renders it inside a loaded world and proves that no world name shows and that no world write occurs.

### World Editor dictionary book panel

- The book panel gets a Details tab and a Placeholders tab, from a tab list in the same form as the other panel tab lists. Details holds Name, Description, Enabled, and the entry count hint. Placeholders holds the scoped placeholder editor in its fill form.
- Placeholders is Advanced only. In Simple mode the panel shows Details with no strip, as the other panels do with one tab.
- The World Editor keeps the chosen book tab while the author selects another book, as it does for entries.

### Dev reachability

- The dev-router ledger for the library entity editor takes the two top tabs plus the three sub-tabs. The dictionary editor's ledger does not change. The World Editor book panel gets a ledger entry for its two tabs.
- The drift guard covers all three.

### Export shape

- No world, save, entity card, or dictionary file shape changes.

## Testing Decisions

- A good test reads what the author sees: which tabs exist, which is selected, which fields are on screen, and what a chip label says. It does not read class names or component state.
- **Library entity editor, rendered whole in jsdom.** Prior art: the entity editor's tabs test and placeholders test. Cases: the two top tabs; the three sub-tabs; Tags present on each sub-tab; opens on Entity and Profile; a field focus request opens the correct sub-tab; no Overview tab.
- **Library dictionary editor, rendered whole in jsdom.** Prior art: the dictionary editor's entry tabs test, which already mounts the real GameData provider around the modal. Cases: opens on the first entry; no book row in the tree; the + adds an entry and selects it; the empty-book hint; Overview holds Name, Description, and Enabled; a rename on Overview renames the book, raises no offer, and changes no stat of the surrounding world; no second Placeholders surface (exists today); an entry name that holds a chip shows the book's placeholder name while the surrounding GameData world holds a different placeholder.
- **Store identity.** One case proves a keystroke in an entry value does not change the modal's store instance. Prove the test bites by removing the memo once.
- **World Editor book panel, rendered in its providers.** Prior art: the book manager test from the guard fix. Cases: two tabs in Advanced mode; no strip in Simple mode; the placeholder editor on its tab.
- **Dev-router drift guard.** Prior art: the existing guard test. It fails when a tab list and its ledger disagree.
- **Widths, one Playwright spec.** Prior art: the entity panel widths spec. At 375, 820, 1280, 1600, and 2560 it asserts the modal width, that no sub-tab label overflows its trigger, that the field column stays at or under the cap, and that the Placeholders panes share the full width. This spec runs outside the four gates.
- Visual checks use the dev router and static frames, in both themes only if a color changes. None is planned.

## Out of Scope

- The World Editor entity panel.
- A fixed width for the list pane of the shared list-detail split.
- A search field in the library entry tree.
- New behavior in the placeholder editor itself. It only gets more room.
- The library world editor, and the library tabs of the main menu.
- Any Persona feature. The Persona mark and the pronouns field stay where that work put them, on Profile.

## Further Notes

- The guard fix that removed the second Placeholders surface landed before this spec, with a changelog entry. The store work here removes the cause.
- The Persona tickets edit Profile and the library entity tiles. They are all on `main`, so this work starts after them with no overlap.
- The changelog needs one user-facing entry for the two editors and one for the World Editor book panel tabs. The chip label fix folds into the first, because the wrong label shipped.
- Docs: the pages that describe the library entity editor's tabs and the dictionary editor's book node need the new layout.
