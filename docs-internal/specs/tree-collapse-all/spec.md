# Spec: Tree Collapse All

Status: ready-for-agent
Spec session: tree-collapse-all — spec

## Problem Statement

A large world fills each World Editor tree with open groups. An author who wants an overview of Locations, Entities, Stats, Traits, Placeholders, Dictionary or Scripts has to close each parent row by hand, one at a time. The card lists in the right panes (openings, placeholder values, Bodies) already have a Collapse All button, and the Openings tab gets one for its owner list (Openings Tab Q25). The other trees have none. A tree also forgets which groups were closed when its tab unmounts, so the author closes them again after each tab switch.

## Solution

Every List Editor that shows a tree gets a Collapse All button right of its search. One press closes every parent row at every depth. When nothing is open, the same button reads Expand All and opens every depth. Each tab keeps its own collapsed groups for the whole World Editor visit, so switching tabs and back keeps them. Nothing is saved to the world or to settings.

The button stays in the toolbar on every tree surface. It is disabled when there is nothing to collapse: while a search shows its flat list of matches, when the tree has no parent rows, and in the Locations canvas view.

## User Stories

1. As an author, I want a Collapse All button right of the search on the Locations tab, so that I can see only the top-level locations.
2. As an author, I want the same button on the Entities tab, so that I can close every entity folder at once.
3. As an author, I want the same button on the Stats tab, so that I can close every stat group and entity node at once.
4. As an author, I want the same button on the Traits tab, so that I can close every trait group at once.
5. As an author, I want the same button on the Placeholders tab, so that I can close every placeholder group at once.
6. As an author, I want the same button on the Dictionary tab, so that I can close every book at once.
7. As an author, I want the same button on the Scripts tab, so that I can close every timing at once.
8. As an author, I want the button in the Entity Editor modal's lists, so that a large entity's stats and traits collapse the same way.
9. As an author, I want the button in the Dictionary Editor modal, so that its book tree collapses the same way.
10. As an author, I want one press to close parents at every depth, so that nested groups don't stay open under a closed parent.
11. As an author, I want the button to become Expand All once nothing is open, so that one control both closes and reopens the tree.
12. As an author, I want Expand All to open every depth, so that I can see the whole tree again in one press.
13. As an author, I want the button to act only on the tab I am on, so that collapsing Locations leaves my open Entities folders alone.
14. As an author, I want each tab to keep its collapsed groups when I switch tabs and come back, so that I don't close them again.
15. As an author, I want the collapsed groups to reset when I close and reopen the World Editor, so that a new visit starts from a known state.
16. As an author, I want a modal's collapsed groups to last while the modal is open, so that working inside it keeps my view.
17. As an author, I want the button disabled while I type a search, so that I can see it is there but understand the flat match list has nothing to collapse.
18. As an author, I want my collapsed groups back when I clear the search, so that a search doesn't undo my overview.
19. As an author, I want the button disabled on a tree with no parent rows, so that the toolbar keeps the same shape on every tab.
20. As an author, I want the button disabled in the Locations canvas view, so that the toolbar keeps its shape when I switch views.
21. As an author, I want the tooltip to name what the tab lists, such as "Collapse all locations", so that I know which list it acts on.
22. As an author, I want the tooltip to say "Expand all" with the same noun when nothing is open, so that I know what the next press does.
23. As an author, I want a row I select from outside the tree (Reveal Origin, Take Me There, a code card link) to still open its parents, so that Collapse All never hides the row I asked for.
24. As an author, I want a row I add inside a collapsed group to still show, so that a new item doesn't vanish into a closed parent.
25. As an author, I want dragging a row to keep working in a collapsed tree, so that collapsing doesn't break reordering.
26. As an author, I want the Openings tab's owner list to collapse with the same button and the same rules, so that every tree in the World Editor acts the same.
27. As an author, I want the Collapse All buttons in the right panes to keep acting on their cards only, so that the list's button and the pane's button never fight.

## Implementation Decisions

- **Collapse state leaves SortableTree.** The tree's collapsed set becomes state its host can own. SortableTree reads the set and reports changes, and still applies its reveal-on-select rule and its drag rule to that set.
- **One collapse-all action on the tree's data.** It derives every parent row id from the adapter's full row list (collapsed set empty) and sets or clears all of them. "Any open" is true when at least one parent row is not collapsed. "Has parents" is true when the full row list has at least one parent.
- **The World Editor owns one collapsed set per tab** for the visit. It holds them by tab, so a tab that unmounts gets its set back on return. Closing the World Editor drops them. Nothing goes into the world, the save envelope or settings.
- **A modal owns its own sets** for as long as it is open.
- **The List Editor shows the button.** It goes in the toolbar's slot after the search, using the shared Collapse All button. The List Editor knows when a search is showing matches and disables the button then. The adapter supplies the noun and says when the tree has no parents or no tree is shown (the Locations canvas).
- **The shared button gains a disabled state.** Its tooltip and noun behavior stay as they are.
- **Nouns follow the tab's item:** locations, entities, stats, traits, placeholders, entries, scripts. The Entity Editor modal's lists use their own item noun. Openings is the exception (Q15).
- **Openings joins after Openings Tab ticket 05 lands.** Its owner list moves onto the same per-tab collapsed set and button, and its own collapse code goes away. Its search keeps the tree and shows matches inside collapsed parents, so its button stays enabled during a search (Q14). Its noun stays "groups" (Q15).
- **Right-pane card-list buttons do not change.** They keep their own collapse model.
- No export-shape change: neither the world nor the save `.json` changes.

## Testing Decisions

- Tests press the real button and assert the rows an author sees. They never read the collapsed set directly.
- **Seam: the World Editor bench and its per-tab benches.** One test per tree tab: collapse hides child rows, Expand All shows them, the tooltip noun is right. One test that collapses a tab, switches to another tab and back, and finds the rows still collapsed. One test that the button is disabled during a search and that clearing the search restores the collapsed rows. One test for disabled with no parent rows, and one for the Locations canvas.
- One test that selecting a row from outside the tree opens its collapsed parents.
- The Entity Editor and Dictionary Editor modals each get one test through their existing modal tests.
- The Openings ticket reruns ticket 05's tests through the shared button.
- No new seam below the List Editor (Q12).
- Prior art: the per-tab benches in the test folder, the Openings toolbar tests, and the existing SortableTree redraw tests, which must stay green.

## Out of Scope

- Collapsing Groups on the Locations canvas.
- Saving collapsed state between visits.
- Changes to the right-pane card-list Collapse All buttons.
- Tree-like surfaces outside the List Editor.
- A keyboard shortcut.

## Further Notes

- Origin: Openings Tab Q26 made this its own spec.
- **Rulings.** Q1: the button is the same control on every tree tab, and each tab collapses only its own tree. Q2: every List Editor tree gets it: Locations (list view), Entities, Stats, Traits, Placeholders, Dictionary, Scripts, and the Entity Editor and Dictionary Editor modals. Q3: during a search the button shows disabled. Q4: a tab's collapsed state lasts the World Editor visit and survives tab switches; it is never saved; a modal's lasts while it is open. Q5: Collapse All closes every depth, and Expand All, shown when nothing is open, opens every depth. Q6: the tooltip uses the tab's item noun. Q7: the button is disabled when the tree has no parent rows. Q8: the button is disabled in the Locations canvas view. Q9: this spec moves the Openings owner list onto the shared collapse state and button, after Openings Tab ticket 05. Q10: right-pane card-list Collapse All buttons stay unchanged and independent. Q11: the user confirmed this summary. Q12: tests use the World Editor bench and the existing modal tests; no seam below the List Editor. Q13: four tickets: 01 the Locations tracer, which owns every shared primitive; 02 the other six tabs; 03 the two modals; 04 Openings. Q14: the disabled rule is "no tree shown", so the Openings button stays enabled during a search, because that search keeps the tree. Q15: the Openings noun stays "groups", because its list holds two kinds of owner. Q16 (ticket 01): the Locations toolbar order is + · search · Collapse All · List/Canvas toggle. Q17: only a new selection reveals its collapsed parents; a tab that remounts with the same selection keeps its groups closed, and the last revealed selection lives in the per-tab store beside the collapsed set. Q18: the disabled button keeps its Collapse all / Expand all tooltip with no reason text, because the reason is on screen. Q19: SortableTree takes an optional host-owned collapse state, and a tree not yet migrated keeps its local set. The List Editor adapter supplies the noun, the parent ids or "no tree shown", and the state. The List Editor derives "any open", the toggle and the disabled rule. The adapter decides "tree shown", so the Openings search case (Q14) fits. LocationTree turns on reveal-on-select. Q20: every outside navigation (Find, Reveal Origin, Take Me There) reveals its row, even when that row is already selected. The host sends a reveal request with each navigation, built in ticket 01 and inherited by later trees. A collapsed id left on a parent that lost its children was a bug before this spec and stays out of scope. Q21 (ticket 02): on Dictionary, Collapse All closes books and their Foreground and Background zones, and Expand All opens both. Q22: the dictionary collapse hook takes an optional host state that holds book ids and zone keys in one set. With no host it stays local, for a caller with no button (Q29 corrects the modal case). Q23: an outside navigation to an entry opens its book and its zone. Q24: parents are rows with at least one child: books and zones with an entry, and Scripts timings with a script. Q25: ticket 02 owns the dictionary collapse hook and the optional collapse prop on the stat and trait trees. Ticket 03 consumes them and lands its Dictionary modal part after 02. Q26 (ticket 03): the Entity Editor modal's Stats, Traits and Placeholders lists all get the button, with nouns stats, traits and placeholders. Q27: the Entity Editor modal holds one collapse store keyed by its tabs, so folds last while it is open and reset when it reopens. Q28: ticket 03 only passes collapse state through to the editors; ticket 02 owns the adapter arguments. Q29: the Dictionary Editor modal creates its own collapse state and passes it to the dictionary hook as its host. Its parents are zones with an entry, because the modal hides the book row, and its noun is "entries".
