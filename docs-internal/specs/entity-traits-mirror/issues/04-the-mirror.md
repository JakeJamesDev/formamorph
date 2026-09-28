# 04: The mirror

Status: ready-for-human
Base: 8f1e7886
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
- [ ] The World Editor holds the mirror's selected id and does not reset it itself; the shared editor clears a selection the entity does not hold. Switching to Profile and back keeps the open trait. A bench test asserts the round trip: open a trait on entity A, select B, select A again, and the list shows rather than the trait.
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

## Comments

- 2026-09-28 (implementation): The mirror is `EntityTraitsMirror`, which builds the world entity store (`useWorldEntityTraitStore`) and renders `EntityTraitsEditor` stacked with `ownerLine` off (Q27). The World Editor holds `entityTraitId` beside `entityTab`. Two rulings came mid-ticket: Q26 makes a one-entity tree's drops land relative to Link rows, so `traitTree.ts` gains `getEntityRootDropProjection` and `applyEntityRootDrop`, and `TraitTree` takes that path whenever the store has an `entityRoot`; the library editor gets the same fix. The mirror also exposed a gap from ticket 03: a one-entity tree's own rows read their gates as the player's, so "Wild 🔒1" on the Traits tab showed as "Wild" in the mirror. `TraitTree` now reads an own row's gate as the root entity's. The old bare list (`EntityTraitsSection.tsx`) is gone; `EntityTraitNodePanel` moved to its own file with the name and **Open Entity** only. The mirror store passes `entities: []`, as the library store does: the field lists the entities whose nodes the tree shows, and a one-entity tree shows none. Four owned-traits assertions changed because the spec changes the behavior: adds and row clicks now stay in the entity, and the node panel lists no traits. Static frames from the dev-router (Emberwatch, Albus) confirmed the list and details states on desktop and inside the mobile push; screenshots of the hidden pane came back tiled, so DOM reads carry the evidence.
- 2026-09-28 (review fold-in): The closing review raised two gaps the shared editor inherited from ticket 03, ruled as Q28 and Q29. Q28: a Link's own row was `fixed` in a one-entity tree; it now drags among the entity's items in the mirror and the library editor alike, and `applyEntityRootDrop` writes its new place. Q29: a **Requires** chip whose target the entity doesn't hold (a world trait, another persona) rendered as a button that cleared the selection; `TraitRequiresField` takes `opens`, `TraitManager` passes `requirementOpens`, and the shared editor answers it from the entity's own ids and its Links' originals. A chip the entity holds opens its row, a Link's row included; "playing as" the entity itself opens only where a host gives `onOpenEntity` (the library editor). Bench tests cover both; each guard was re-broken to prove it fails.
- 2026-09-28 (user rulings from the frames): Q30, a stacked push takes the panel's surface (`bg-card`), the top-level mobile push keeps the page's (`bg-background`); `ListDetail` switches on `stacked`. Q31, **This Link**'s pinned-value rows share one label column: the list is a two-column grid with an auto label column, each row `contents`, so the longest label sets the column and every select starts on the same x. Both hold in the library editor too. DOM reads on Emberwatch's Albus: the push's background equals the card's, four selects at one left edge.
- 2026-09-28 (Q31 refined from the frame): the arrows line up too, and the labels stay left-aligned. The pinned-value grid has three columns, label, arrow and select, each `auto` but the last. Measured on Albus's Classes link: every row's label, arrow and select start at one x each.
