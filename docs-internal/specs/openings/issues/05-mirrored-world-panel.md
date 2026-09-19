# 05: Mirrored World Openings Panel

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

**Parent:** [Openings](../spec.md)

**What to build:** The World Editor's opening panel shows every opening in the world in one place. The world's own rows come first, then one group for each authored entity that has openings. The author edits any row in place, and the change lands on its owner. The one world switch covers the whole panel. An entity that is at no starting location carries a mark, so the author sees why its openings never come up.

**Rationale for the model:** one screen that writes to several owners, with a drag and scroll area that has known traps. Opus at medium effort.

## Acceptance criteria

- [ ] The Openings module returns the editor view: all openings grouped by owner, the chance of each row, and a flag for an entity at no starting location. The panel renders that view and computes nothing itself.
- [ ] An edit, a weight change, an add, a remove, or a reorder inside an entity's group changes that entity. The entity's own Openings tab shows the same data.
- [ ] A world with one starting location shows plain chances. A world with several states which starting location the chances describe.
- [ ] The mark for an entity at no starting location uses a defined term and a tooltip, not color alone.
- [ ] The group header names the entity and opens that entity's Openings tab.
- [ ] World Editor discard rolls back edits made through the panel, the same as edits made in the entity tab.
- [ ] A long list scrolls by wheel inside the panel, and row drag works inside the scroll area.
- [ ] Component tests prove that a panel edit changes the entity and that groups follow the entities. One guard is proven by reinstating its fault.
- [ ] The panel is checked in the preview with several entities, in both themes and at mobile width, with static DOM evidence.
- [ ] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

No data change and no export-shape change. Library entities picked at Enter World are not authored into the world and do not show here.
