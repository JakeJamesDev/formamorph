# Spec: Option Stat Rows

Status: ready-for-agent
Spec session: option-stat-rows — spec

## Problem Statement

An author wants a setup switch that changes the numbers: "Easy" gives more starting Gold, "Hard" slows Health regen. Today there are two ways to do it, and both cost too much.

- **Stat code** can read `options` and change a stat, but only authors who write code can use it.
- **A trait** gated on the Option can carry stat changes. But the trait's text goes to the AI every turn, and the player sees it in the trait tree. A difficulty switch is not a trait of the character.

## Solution

Each value of a choice World Option, and each state of an On or Off World Option, gets its own **stat rows**. These are the same rows a trait has: stat changes (starting, regen, min, max) and stat toggles. They use the same editor.

The rows act on stats like a trait's rows do, and they stack with traits. They never go into the prompt and never show as a trait. The player sees them as a list under the value, so they know what Hard costs before they pick it.

## Rulings

- **Q1 Vehicle.** Stat effects live as rows on each Option value. There is no hidden trait and no gate.
- **Q2 Types.** Choice values and boolean states get rows. Number Options and Preset Options do not.
- **Q3 Rows.** The rows match a trait's: stat changes (starting, regen, min, max, with interval) and stat toggles.
- **Q4 Stacking.** Option rows stack with trait rows on the same stat, summed the way two traits' rows sum.
- **Q5 Starting at game start only.** Starting rows apply once, at game start, for the value in force then. A mid-game change (the in-play Options tab, or code writing `options`) moves bounds, regen and toggles at once. It never moves a stat's value. Easy's Gold stays after a switch to Hard.
- **Q6 Reach.** Rows can move global stats and entity stats.
- **Q7 Boolean.** A boolean Option has one row list for On and another for Off.
- **Q8 Shown.** The player sees each value's rows in setup and in the in-play Options tab, in the trait-list form ("Gold: +100"). Rows on hidden stats are left out. The AI never sees the rows.
- **Q9 Picker.** The stat picker drills World first, then one page per entity. An entity's page holds its own stats and the stats its Blueprints give it, named "Wolf: Health".
- **Q10 Per entity.** A row moves one entity's stat. There are no Blueprint-wide rows.
- **Q11 In play.** The in-play Options tab leaves starting rows out of each value's list, so it shows only what a switch changes now.
- **Q12 Shape names.** A choice value has `statChanges` and `statToggles`. A boolean has `onStatChanges`, `onStatToggles`, `offStatChanges` and `offStatToggles`. The owner field is `ownerId`. (Ticket 01.)
- **Q13 Editor.** One stat-row editor serves traits and Options. Toggles show in Advanced mode only, as on traits. There is no interval control; interval stays a shape field. (Ticket 01.)
- **Q14 Owner rows before 02.** Ticket 01's picker offers global stats only. A row with an `ownerId` is ignored at runtime until ticket 02. (Ticket 01.)
- **Q15 Enter World preview.** The stat numbers shown before the game starts include the picked values' starting rows. (Ticket 01.)
- **Q16 Save load.** Loading a save re-derives bounds and toggles under the world's current rows and Option values, and clamps a value above a new max. Starting rows never apply on load. (Ticket 01.)
- **Q17 One source for every reader.** Option rows feed the same in-force source that bounds, toggles, gate stat reads and stat code use, ahead of traits. Option rows never appear as traits: not in the prompt, the Traits tab, a trait gate, or a trait count. (Ticket 01.)
- **Q18 Deleted targets.** A row whose stat or entity was deleted stays in the file and does nothing, exactly as a trait row does. Nothing prunes it on load or on delete. Player lists leave it out. (Ticket 01.)
- **Q19 Entity reach.** An entity row moves the entity's stat whenever that entity holds stat values in the playthrough, in play as an owner or not. (Ticket 02.)
- **Q20 No fallback.** An entity row whose entity lacks the stat is ignored. It never falls back to the global stat with that id, unlike a trait row. (Ticket 02.)
- **Q21 Picker pages.** World holds the global stats. Each world entity that holds stats (own or from a Blueprint) gets a page; entities with none are left out. Library entities get no page. (Ticket 02.)
- **Q22 Picker scope.** Only Option rows get the Breadcrumb Picker. The trait stat-row editor keeps its Select. (Ticket 02.)
- **Q23 Changelog.** Tickets 02 and 03 write no fragment. The spec session folds a clause into ticket 01's entry on main after each landing. (Tickets 02, 03.)
- **Q24 Close review gaps.** The close review found three gaps, now tickets 04–06: the Enter World preview's entity starts, stale bounds on load, and the paged-back AI scene.
- **Q25 Toggles not listed.** Player lists show stat changes only, never toggle rows, matching the trait lists.
- **Q26 Setup gates and pick effects.** Open. Under discussion with the user; it changes how traits work and may get its own spec.
- **Q27 One opening path.** The Enter World preview seeds global and entity starts through the same steps as the game opening, so entity trait starts apply there too. (Ticket 04.)
- **Q28 Pins read Option toggles.** Stat-band Pins read Option toggles ahead of traits for every caller: play, the opening, Test Bench and the preview. A stat an Option turns off never pins. (Ticket 04, from Q17.)
- **Q29 Editor scene.** The editor's authored scene reads each Option at its default. A caller with picks, such as Test Bench, passes its values. It seeds stats through the Q27 steps. (Ticket 04.)

## User Stories

1. As an author, I want to add stat changes to a choice Option's value, so that a difficulty value changes the numbers without a trait.
2. As an author, I want to add stat changes to an On or Off Option's On state, so that a "Hardcore" switch can slow regen.
3. As an author, I want to add stat changes to the Off state too, so that the default mode can carry its own effect.
4. As an author, I want to give a value more starting Gold, so that Easy starts the player richer.
5. As an author, I want to change a stat's regen per value, so that Hard heals slower than Easy.
6. As an author, I want to raise or lower a stat's min and max per value, so that a mode can widen or narrow a stat's range.
7. As an author, I want to set a regen interval on a row, as on a trait, so that the effect uses the cadence I choose.
8. As an author, I want to turn a stat on or off per value, so that Hard can switch on a Hunger stat that Easy leaves off.
9. As an author, I want the rows to use the same editor as a trait's stat rows, so that I don't learn a second form.
10. As an author, I want to pick a global stat for a row, so that a mode can change shared stats.
11. As an author, I want to pick an entity's own stat for a row, so that Hard can make the Dragon tougher.
12. As an author, I want the stat picker to drill World first and then one page per entity, so that big worlds stay easy to search.
13. As an author, I want an entity's page to include the stats its Blueprints give it, so that I can reach Blueprint stats on that one entity.
14. As an author, I want entity stats named "Wolf: Health", so that the owner form matches the rest of the editor.
15. As an author, I want Option rows to stack with trait rows, so that "Easy +100 Gold" and a "Rich" trait's "+50 Gold" give +150.
16. As an author, I want a hidden Option's rows to still apply, so that a script-only mode switch can change stats.
17. As an author, I want a row whose stat or entity was deleted to do nothing, as a trait row does, so that deleting a stat never breaks a game.
18. As a player, I want to see each value's stat rows under it in setup, so that I know what a mode does before I pick it.
19. As a player, I want the rows in the same "Gold: +100" form as the trait lists, so that I read them the same way.
20. As a player, I want rows on hidden stats left out of the list, so that hidden stats stay hidden.
21. As a player, I want the starting rows of my picked values to apply when the game starts, so that Easy really starts me richer.
22. As a player, I want a mid-game Option change to move regen, bounds and toggles at once, so that switching to Hard takes effect now.
23. As a player, I want a mid-game change to never move my stat values, so that switching modes can't be used to farm Gold.
24. As a player, I want the in-play Options tab to show only what a switch changes now, so that it doesn't promise Gold a switch won't give.
25. As a player, I want a Preset that picks Hard to give Hard's rows, so that a Preset and a hand pick end in the same game.
26. As an author, I want stat code to read the effective min, max and regen with Option rows included, so that code sees the real stat.
27. As an author, I want a code write to `options` to move bounds, regen and toggles like a player's change, so that code and the tab agree.
28. As an author testing in Test Bench, I want my picked values' starting rows applied to the opening, so that the bench matches play.
29. As a player loading a save, I want the Option rows to come from the world as it is now, so that an author's fix reaches my game.
30. As a player, I want the AI to never see Option rows, so that a difficulty switch doesn't change the story's text.

## Implementation Decisions

- **World shape.** A choice Option's value gains optional stat-change and stat-toggle row lists. An On or Off Option gains one pair of lists for On and one pair for Off. This follows the existing pattern for Pins on Option values and states. The row shapes are the trait's `StatChange` and `TraitStatToggle`, plus an optional owner field naming an entity. With no owner, a row moves the global stat.
- **Export shape.** The change is additive to world `.json`. No save shape changes: the rows are read from the world, never copied into the save.
- **Runtime source.** Option rows are one more source of stat contributions in the stat runtime, next to traits, items and code. The source is "the rows of each valued Option's current value". It is read live from the world and the current Option values. It is not frozen at game start the way a saved trait's stat changes are.
- **Bounds and regen.** Deriving effective stats adds the Option rows' min, max and regen contributions to the global stats, and each entity row to that entity's stats. The existing floors apply: min never goes below the authored base min, and max never goes below min.
- **Toggles.** Working out which stats are enabled reads Option toggles as well as trait toggles. Option toggles apply before trait toggles, so a trait toggle wins over an Option toggle on the same stat.
- **Starting rows.** Seeding a new game adds each picked value's starting rows once, after the stats' authored starting values and before the starting traits apply. Starting rows are never applied again and never reversed. They need no applied-value record.
- **Mid-game change.** Every path that changes Option values in play re-derives global and entity stats: the in-play Options tab, stat code and script writes to `options`, and gate settling after a change. A change never moves a stat's value, except where a new bound clamps it.
- **Test Bench.** The Test Bench opening seeds the author's picked values' starting rows, the same as a new game.
- **Not in the prompt.** Option rows add nothing to any prompt. Only their effect on stat values, bounds and enabled state reaches the AI, the same way any stat already does.
- **Editor.** The Options panel shows a stat-row editor under each choice value and under each boolean state. It reuses the trait stat-row editor. The stat picker is a Breadcrumb Picker with a World page and one page per entity, the same tree and "Wolf: Health" owner form the Preset rows use. Number and Preset Options show no stat rows.
- **Player lists.** The setup Option control and the in-play Options tab list each value's rows in the trait-list form. Rows on hidden stats are left out. The in-play tab also leaves starting rows out.
- **Deleted targets.** A row whose stat or entity no longer exists stays in the file and is ignored at runtime, as trait stat rows are. Nothing prunes it on load or on delete (Q18).

## Testing Decisions

- Good tests drive public behavior: seed a game, change an Option, read the stats. They never assert on internal helper calls.
- **Stat runtime seam.** Pure tests on the stat runtime, the way `traitRuntime.test.ts` and `traitRuntime.entityStats.test.ts` test it:
  - Starting rows apply once at game start, for globals and for one entity's own stat.
  - Option rows stack with a trait's rows on the same stat.
  - A mid-game change moves min, max and regen at once and leaves values alone, except for a clamp.
  - Toggles: an Option toggle turns a stat on, and a trait toggle on the same stat wins.
  - Each guard is proved by reinstating its bug and watching the test fail.
- **World Editor seam.** Render tests on the Options panel, the way `WorldEditor.presetOption.test.tsx` tests Preset rows: add a row to a choice value and to a boolean state, and pick an entity stat through the drill-down.
- **Player seam.** Render tests on Enter World, the way `EnterWorldFlow.test.tsx` does, and on the in-play Options tab: the list shows the rows in the trait-list form, leaves out hidden stats, and in play leaves out starting rows.

## Out of Scope

- Stat rows on number Options. This includes any scaling math, such as "Gold × Difficulty".
- Stat rows on Preset Options. A Preset reaches stats only by picking a value that has rows.
- Blueprint-wide rows that move a stat on every bearer at once.
- Applying starting rows again on a mid-game change.
- A stat-side breakdown that lists where a stat's bounds come from.

## Further Notes

- A hidden Option's rows still apply. A hidden Option already pins and gates, so its rows follow the same rule. Its rows are not listed, because the Option itself is not shown.
- A stat at its cap does not follow a raised cap on a mid-game change. This follows Q5: a mid-game change never moves a value.
