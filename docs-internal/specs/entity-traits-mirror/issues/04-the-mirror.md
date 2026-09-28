# 04: The mirror

Status: ready-for-agent
Blocked by: 02 — Entity panel tabs fill the pane; 03 — Shared entity traits editor with the toolbar in the library
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

Rationale: the widest ticket. It wires a new store, a new layout mode and lifted selection into the god node, and its tests carry most of the user stories.

Parent: [Entity Traits Mirror spec](../spec.md)

## What to build

The entity panel's **Traits** tab is a mirror of the **Traits** tab limited to that entity. An author sees the entity's tree with the same rows and row buttons, a toolbar above it, and a slide-in details view with a back row. They can search, add by name, reorder and nest inside the entity, and edit a Link's own values, all without leaving the entity. Rulings Q2 to Q5, Q9 to Q15.

## Acceptance criteria

- [ ] A world Trait Store over one entity: its traits and groups fill the root, writes land through the world's entity edit, Links read their Originals live from the world, gates read the whole world, the requirement picker offers personas, and the pin rows read the world.
- [ ] The entity **Traits** tab renders the shared editor stacked, filling the pane, with the toolbar in place while the list and the details scroll inside. No **?** help button.
- [ ] The **+** menu has **Add Trait to <entity>** and **Add Group to <entity>** only. The search text names the new item, the box clears, and the new item's details slide in.
- [ ] Search matches the entity's traits and Links as a flat list; groups are not listed; no match shows a "no traits match" line. An empty entity shows a hint to add its first trait.
- [ ] Drags reorder and nest inside the entity only. No cross-owner drop and no drop-to-link.
- [ ] Selecting a Link shows its Linked-from line and **This Link**. The details have no link to the **Traits** tab.
- [ ] The World Editor holds the mirror's selected id. Switching to Profile and back keeps the open trait; selecting another entity returns the mirror to its list.
- [ ] On mobile the details are a second push inside the pushed entity panel with their own back row.
- [ ] The **Traits** tab's entity node panel shows the entity's name and **Open Entity** only. The old bare list component is removed. The **Traits** tab's search still matches world traits only.
- [ ] Basic mode still hides the tab.
- [ ] Bench tests cover: list, search, **+** menu, slide to details and back, selection kept across a tab switch, reset on entity change, reorder inside the entity, Link details, the node panel's reduced content, Basic hides the tab.
- [ ] Static frames from the dev-router show the list and the details states on desktop and inside the mobile push.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] No export-shape change; say so in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.
