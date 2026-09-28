# 01: List toolbar widget, World Editor migrated

Status: ready-for-human
Base: c42530c9
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Rationale: a prefactor of the god node's toolbar with every tab's tests as the net. The widget's shape sets what tickets 03 and 04 can compose, so the menu slot and the name-from-search rule must be right first.

Parent: [Entity Traits Mirror spec](../spec.md)

## What to build

The World Editor's list toolbar becomes a shared widget and every World Editor tab uses it. An author sees no change: search filters the same way, the search text names a new item, the **+** menus drill in as before, and the Dictionary and Placeholders boxes still only name new items. Rulings Q6, Q17, Q19.

## Acceptance criteria

- [ ] A shared widget owns the search term, the search box, the **+** control, and the name-from-search rule. A caller gives it one add action or menu content as a slot, the placeholder text, and any extra toolbar content.
- [ ] A menu row or add action receives the trimmed search text, and the widget clears the term after the add.
- [ ] The placeholder-aware match (row label, chip names, described values) moves out with the widget, and the World Editor's tabs return the same results as before.
- [ ] The Traits tab's drill-in menu and its conditional rows compose inside the menu slot. **Add Templates Group** still ignores the search text.
- [ ] The tour anchor on the **+** and the find-bar skip attribute on the search box are kept, and the authoring tour tests pass.
- [ ] Every existing World Editor toolbar test passes unchanged. Any changed assertion has a stated reason in the commit body.
- [ ] The World Editor view is smaller than before the move.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] No export-shape change; say so in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
