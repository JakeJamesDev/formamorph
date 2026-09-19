# 05: Mirrored World Openings Panel

Status: ready-for-human
Base: c0ba2b9f
Blocked by: 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

**Parent:** [Openings](../spec.md)

**What to build:** The World Editor's opening panel shows every opening in the world in one place. The world's own rows come first, then one group for each authored entity that has openings. The author edits any row in place, and the change lands on its owner. The one world switch covers the whole panel. An entity that is at no starting location carries a mark, so the author sees why its openings never come up.

**Rationale for the model:** one screen that writes to several owners, with a drag and scroll area that has known traps. Opus at medium effort.

## Acceptance criteria

- [x] The Openings module returns the editor view: all openings grouped by owner, the chance of each row, and a flag for an entity at no starting location. The panel renders that view and computes nothing itself.
- [x] An edit, a weight change, an add, a remove, or a reorder inside an entity's group changes that entity. The entity's own Openings tab shows the same data.
- [x] A row's chance is its share of the whole pool at one starting location: the world's rows plus the rows of every entity present there. The chances of one pool total 100 percent together, not per owner. The module takes the location as an argument.
- [x] A world with one starting location shows plain chances and no picker. A world with several shows a starting location picker in the panel, set to the first starting location, and the chances follow it. The picked location is view state and is never stored on the world. Starting locations resolve the same way the game start resolves them.
- [x] A row of an entity that is not at the described location shows a dash and a short note that names the location, never 0 percent. Only a weight 0 row shows 0 percent. For an entity at no starting location, the rows show a dash and the group mark gives the reason.
- [x] With the world switch off, the panel shows its off state and keeps the chances the list would have. It does not blank the column.
- [x] The mark for an entity at no starting location uses a defined term and a tooltip, not color alone.
- [x] The group header names the entity and opens that entity's Openings tab.
- [x] World Editor discard rolls back edits made through the panel, the same as edits made in the entity tab.
- [x] A long list scrolls by wheel inside the panel, and row drag works inside the scroll area.
- [x] Component tests prove that a panel edit changes the entity and that groups follow the entities. One guard is proven by reinstating its fault.
- [x] The panel is checked in the preview with several entities, in both themes and at mobile width, with static DOM evidence.
- [x] Typecheck, lint, tests, and build pass; report test wall time. Update the code graph. Add a changelog entry in the In Progress section.

## Scope notes

No data change and no export-shape change. Library entities picked at Enter World are not authored into the world and do not show here.
