# 02: Entity Option Stat Rows

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An Option row can move one entity's own stat, including a stat its Blueprints give it. The spec covers this in Q6, Q9 and Q10.

- **Runtime.** A row with an owner moves that entity's stat, through the same paths ticket 01 built: starting rows at game start and in Test Bench, min, max and regen stacking with the entity's trait rows, toggles, and every mid-game re-derive.
- **Blueprint stats.** A row on a Blueprint stat moves that one entity's copy only. There are no Blueprint-wide rows.
- **Editor.** The stat picker becomes a Breadcrumb Picker: World first, then one page per entity, holding the entity's own stats and its Blueprint stats. Rows read "Wolf: Health", the owner form the Preset rows use.
- **Deleted targets.** A row whose entity or stat no longer exists is dropped on load and ignored at runtime.
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md) for entity rows. Fold into ticket 01's changelog entry if it has not been released.

## Acceptance criteria

- [ ] A starting row on the Dragon's Health applies at game start to the Dragon only.
- [ ] A row on a Blueprint stat moves the named entity's copy and no other bearer's.
- [ ] A mid-game switch moves an entity's max and regen at once and leaves its value alone.
- [ ] An Option row and the entity's own trait row on the same stat stack.
- [ ] A row naming a deleted entity is dropped and does not throw.
- [ ] Each runtime guard above goes red with its bug reinstated.
- [ ] Editor render test: drill to an entity page and pick a Blueprint stat. The row reads in the owner form.
