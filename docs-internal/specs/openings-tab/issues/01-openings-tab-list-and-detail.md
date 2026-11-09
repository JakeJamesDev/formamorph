# 01: Openings Tab List and Detail

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a new top-level editor tab on the List Editor shell, with a nested tree list, a selection rule that outlives the list (Q12), and search over opening text.

## What to build

An Advanced-only **Openings** tab in the World Editor, right after Overview (Q1, Q6). Simple mode never shows it.

- **The list** (Q2, Q8, Q11, Q14): "This World" pinned first and always present. Then the locations that have openings in the location tree's nesting, a rule, and the entities that have openings in their folder nesting. A parent location or entity folder that holds no listed owner but contains one shows as a dim row that can't be selected. Each owner row shows its opening count on the right and the No Starting Location icon when its openings never come up.
- **The detail pane**: the selected owner's icon and name, with the name linking to that location's or entity's own Openings tab (Q5). **Add Opening** sits in the pane's header and adds a blank opening to that owner, This World included. Then the No Starting Location note when it applies, the default-opening note on This World when no opening can come up, and the owner's openings as the existing openings list draws them, without its own add button.
- **Search** (Q4): one box for the tab. An owner row stays when its name or any of its openings' text matches. The pane shows only the matching openings. This World always stays.
- **Starting Location filter** (Q13): at the top of the list, only when the world has more than one start. It narrows the list as the current Openings panel's filter does.
- **Selection** (Q12): the selected owner is session editor state, like the other list tabs. An owner whose last opening is deleted stays listed while it is selected and leaves the list on the next selection. A deleted owner falls back to This World.
- The + button in the toolbar can be a placeholder that adds to This World until 02 lands. The Overview's Openings tab stays as it is until 03.
- Add the tab to the dev-router ledger and the Nav Rail reference.

Reference: the prototype's variant B (spec, Further Notes). Rebuild it properly; don't copy the prototype's switcher.

## Acceptance criteria

- [ ] The tab shows in Advanced mode only, between Overview and Media (editor-bench test)
- [ ] This World is listed in a world with no openings; owners without openings are not listed; nested owners sit under dim context rows (editor-bench test)
- [ ] Rows show the count and the No Starting Location icon (editor-bench test)
- [ ] Add Opening adds a blank opening to the selected owner, This World included (editor-bench test)
- [ ] Deleting an owner's last opening keeps its row until another row is selected (editor-bench test, mutation-tested)
- [ ] Search keeps rows that match by name or by opening text, and the pane shows only matching openings (editor-bench test, mutation-tested)
- [ ] The filter narrows the rows to one start (editor-bench test)
- [ ] An edit on the new tab shows on the owner's own Openings tab (editor-bench test)
- [ ] The owner link opens that location's or entity's Openings tab
- [ ] Frames `.scratch/frames/openings-tab-list.png` at 1280×800 in both themes, and `.scratch/frames/openings-tab-mobile.png` at 375×812 dark
- [ ] The World Editor docs describe the tab; a changelog fragment is written

For you: open a world with many openings (Fantasy Futanari) on the Openings tab and judge whether the nesting reads well.
