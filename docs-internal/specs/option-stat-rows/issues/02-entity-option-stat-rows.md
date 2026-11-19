# 02: Entity Option Stat Rows

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An Option row can move one entity's own stat, including a stat its Blueprints give it. The spec covers this in Q6, Q9 and Q10.

- **Runtime.** A row with an owner moves that entity's stat, through the same paths ticket 01 built: starting rows at game start and in Test Bench, min, max and regen stacking with the entity's trait rows, toggles, and every mid-game re-derive.
- **Blueprint stats.** A row on a Blueprint stat moves that one entity's copy only. There are no Blueprint-wide rows.
- **Editor.** The stat picker becomes a Breadcrumb Picker: World first, then one page per entity, holding the entity's own stats and its Blueprint stats. Rows read "Wolf: Health", the owner form the Preset rows use.
- **Deleted targets.** A row whose entity or stat no longer exists stays in the file and is ignored at runtime, as trait rows are. Nothing prunes it (spec Q18).
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md) for entity rows. Fold into ticket 01's changelog entry if it has not been released.

## Acceptance criteria

- [x] A starting row on the Dragon's Health applies at game start to the Dragon only. `traitRuntime.entityOptionRows.test.ts` › applies at game start to that entity only.
- [x] A row on a Blueprint stat moves the named entity's copy and no other bearer's. › moves the named entity's copy of a Blueprint stat.
- [x] A mid-game switch moves an entity's max and regen at once and leaves its value alone. › a mid-game Option change on entity stats (two tests).
- [x] An Option row and the entity's own trait row on the same stat stack. › stacks with the entity's own trait rows.
- [x] A row naming a deleted entity is ignored and does not throw. › is ignored when it names a deleted entity; does not throw for a row naming a deleted entity.
- [x] Each runtime guard above goes red with its bug reinstated. Seven mutations (Option rows dropped from entity sources, no entity starts, owner filter leak, no entity re-derive, own traits settled without Option rows, deleted-entity guard, live-scene toggles): each turned its test red; sources restored.
- [x] Editor render test: drill to an entity page and pick a Blueprint stat. The row reads in the owner form. `WorldEditor.optionStatRows.test.tsx` › drills to an entity page and picks a Blueprint stat.

## Landed

Also fixes a ticket 01 opening clamp: an entity's global-row trait at game start derived bounds without the Option rows, so a start above the base max clamped (`traitRuntime.optionRows.test.ts` › keeps the Option's raised max). Entity Option toggles also reach the AI scene's entity stats (`liveScene.test.ts`).

**Not verified**
- Nothing unticked.

**For you**
- Options tab: open a stat picker in a world with many stats and drill World → an entity page; judge the "Wolf: Health" rows.
- Known gaps left alone: the Enter World preview and the editor's authored scene seed entity stats without Option starting rows or toggles (entity trait starts are missing there too).
