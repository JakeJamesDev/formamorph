# 01: Subtree Pages

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

On the Enter World setup screen, clicking an entity or a parent group in the category nav opens one page with its whole subtree. A leaf group still opens only itself. The spec covers this in Q1, Q2, Q7, Q12 and Q14.

- The trait workspace module gains the nav model: for each node, whether it has children, its ancestor ids, and its subtree in authored order. This ticket owns that model. Ticket 02 builds on it.
- A group that holds only child groups becomes a clickable nav row with its own page. Today it is a plain label.
- A subtree page shows the node's own traits first: the entity heading for an entity, or the group name. Each descendant group follows under a `LABEL ———` separator, in the style of the nav's "Starting Traits" separator. The separator is labeled with the group's path below the page (for example, `Martial / Weapon Style`). Each section keeps its own description, pick rule, "Choose N more" hint and gates. The trait cascade notice shows once per page.
- A parent row shows the summed selected / total count of its subtree, even while expanded, plus a short marker when any group in the subtree is below its minimum picks. A leaf row behaves as it does today, plus the marker.
- The category index still points at a real category (the node's first one), so the Begin check and the World Options, Persona, Starting Location, Library Additions and General pages are unchanged.
- No chevrons and no collapse in this ticket. The nav stays fully expanded.

Prior art: prototype `prototype/setup-nav-fallthrough` (`07da61d2e`), which has the subtree page and the rollup inline in the workspace view. Rebuild them properly in the module and the view.

## Acceptance criteria

- [ ] Clicking an entity row shows that entity's heading, then every one of its groups in authored order, each nested group under a separator that names its path below the entity.
- [ ] Clicking a world parent group shows its own traits (if any), then every descendant group under separators.
- [ ] Clicking a leaf group shows only that group, as today.
- [ ] A label-only group is a clickable row, and its page lists its descendants under a heading with its name and description.
- [ ] Each section shows its own group's player description and pick rule, and the "Choose N more" hint when it is short.
- [ ] A parent row's count is the sum over its subtree, with unseen traits excluded the same way as the per-group counts.
- [ ] A row shows the short marker when a group in its subtree is below its minimum, and loses it once the picks are met.
- [ ] Selecting a trait in any section of a subtree page updates that section, the parent row's count, and the Begin state.
- [ ] Unit tests on the trait workspace module cover children, ancestors, subtree order, label-only groups, and the rollup counts.
- [ ] Component tests on the Enter World workspace cover the entity page, the world parent page, the leaf page and the label-only page. Each guard is shown to bite by restoring the old one-group page.
- [ ] Frames: `.scratch/frames/entity-subtree-dark.png` and `.scratch/frames/entity-subtree-light.png` at 1440×900, showing an entity page with nested sections.
- [ ] Changelog fragment under 👤 Added for the Enter World setup screen.

For you: open Enter World on a world with a large cast and check that a character's single page reads well.

## Comments
