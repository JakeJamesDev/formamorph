# 03: Shared entity traits editor with the toolbar in the library

Status: ready-for-agent
Blocked by: 01 — List toolbar widget
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Rationale: the store split and the editor's prop shape are what ticket 04 builds on, and the library links and gates have subtle off-world rules that the existing tests pin.

Parent: [Entity Traits Mirror spec](../spec.md)

## What to build

An author editing a library entity gets the World Editor's search box and **+** menu on its **Traits** tab in place of the **Add Trait** and **Add Group** buttons. Typing a name and pressing **+** adds a trait with that name and opens it beside the list. While a search is typed the list shows a flat list of matching traits and Links. The list and details stay side by side. Rulings Q1, Q7, Q9 (library half), Q16.

## Acceptance criteria

- [ ] The library trait editor becomes one entity traits editor that takes a Trait Store, a layout (stacked or side by side), and the selected id with its setter. It owns the details tab and resets selection when the entity changes.
- [ ] The library editor holds its own selection and renders the editor side by side. Its selection still resets on a tab switch.
- [ ] The Trait Store's "root is one entity" flag is separate from `offWorld`. The library store sets both; nothing else changes for it.
- [ ] The library **Traits** tab shows the toolbar with **Add Trait to <entity>** and **Add Group to <entity>**, the name drawn through its placeholders. The search text names the new item, the box clears, and the new item's details open.
- [ ] While a search is typed the list is a flat list of matching traits and Links with remove and duplicate from the entity's own handlers; groups are not listed. An empty match shows a "no traits match" line.
- [ ] The library tab's own empty hint stays.
- [ ] Rendered library editor tests cover the toolbar, name-from-search, flat search, and the side-by-side layout. Existing library trait tests pass.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] No export-shape change; say so in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
