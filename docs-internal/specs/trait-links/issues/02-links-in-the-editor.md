# 02: Links in the editor

Status: ready-for-human
Base: 418b140f
Blocked by: 01 — Link data and bearer resolution
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the shared drag layer, a new row kind, a new Details layout and four cascade confirmations in one editor surface. Dense UI wiring with a ruling to fetch first.

Parent: [Trait Links spec](../spec.md)

## What to build

In Advanced mode an author drags a world trait or group under an entity and gets a link. The link row shows a link icon, reads the original live, and sits anywhere in the entity's subtree. Selecting it edits the original under a "Linked from" line, with a This Link section for the link's own default-on. Detach turns it into an owned copy. Deleting an original removes its links after a confirmation that names the count. Deleting an entity takes its own links with it.

## Acceptance criteria

- [ ] Ask the spec session first whether a cross-owner move gesture survives (the open drag ruling), and build what it answers.
- [ ] Dropping a node from outside an entity onto that entity creates a link through the shared drag layer. The drop projection lets links sit anywhere in a bearer's subtree and never offers a link inside Templates or at the root. A second link to an original the bearer's tree already holds is refused.
- [ ] The link row shows a link icon in the trait icon's slot. A linked group shows the original's live subtree and keeps its exclusivity.
- [ ] Selecting a link shows the original's Details, editable, under "Linked from **<location>**. Edits change every link." Below is a This Link section with default-on. Pin rows arrive in ticket 06.
- [ ] A linked trait with stat effects under a cast entity shows the note "Stat changes apply only when you play as them" in the link section.
- [ ] The row action reads **Detach** where an owned row reads **Duplicate**. Detach gives the copy a new id and drops the link. When the original has stat changes or stat toggles, a confirmation says the copy is made without them.
- [ ] Deleting an original deletes its links after a confirmation that names the count. Deleting an entity takes its owned traits and its links with it. Removing a link leaves the original untouched.
- [ ] With Advanced off, existing links still show and stay editable; creating them stays Advanced-only.
- [ ] The link row is a new visual pattern and gets design-system approval before adoption.
- [ ] Component tests cover the link row, the Linked-from Details, the This Link section and each confirmation. Tree tests cover the drop projection and the duplicate refusal.
- [ ] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [ ] State every export-shape change in the response.
- [ ] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**From ticket 01 (2026-09-27, commit 72f20e90).** The bearer module is `src/lib/bearers.ts`. The tree builder's `ownsTraits` in `traitTree.ts` still ignores links; switch it to `bearsTraits` from the bearer module so an entity with links only still gets its node.

**From ticket 02 (2026-09-27).** `ownedTraitTree` draws links only with `{ links: true }`, which the editor passes; Enter World, the in-game Traits tab and the pin readers still build it without links. Ticket 08 moves them to `resolveBearers` and can drop the option. Link edits live in `src/lib/traitLinks.ts`. Open, not ruled: a world-to-world move can still give a bearer one original twice (it links T and G, and T moves into G); and deleting an entity has no confirmation naming its link count. The design-system approval of the link row is still with the user.
