# 17: Player's Starting Location And Begins Following

Status: ready-for-human
Blocked by: 14
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The world shape changes. Say so in the landing report (export-shape reminder).

## What to build

An author can make a companion that begins beside the player and travels with them from the first turn, in a world with one starting location or many.

- **Player's Starting Location** is a choice in every Start's place picker, for both kinds. It is a stored value, not a location id. It resolves once at New Game to the location where the player begins, and the save keeps the result.
- **Rows on such a Start:** allowed. Its pickers offer every location, because there is no fixed place to test connections from. Play skips a place the entity can't reach from the real start.
- **Begins Following** is a setting on a Start. It shows only when the Start's place is Player's Starting Location and the entity is an Individual. With it on, the entity's follow state starts as Following in a new game, ignoring Strict, as a script `.follow()` does. It takes effect only when that Start is rolled.
- **A Group** can use Player's Starting Location. Its presence begins beside the player and then runs its rows. It never follows.
- **Canvas:** such a Start draws no "Starts Here" flag. The status line and the key stay true to that.
- The derived `locations` list gets no place from Player's Starting Location.

Read `docs/Writing-Guide.md` ("Before you write") before naming the picker entry and the setting. The names here are working names.

User-facing text calls the kinds Unique and Generic (Q162). Code keeps `individual` and `group` until ticket 19.

Spec rulings: Q147, Q148, Q149, Q150, Q64, Q54, Q162, Q163.

## Acceptance criteria

- [x] A Start at Player's Starting Location puts the entity where the player begins, for each starting location of a world with several, and for an opening that sets its own start. Position engine tests cover both. (`positionEngine.test.ts`: "begins at each starting location…", "begins where the game began, not where the player stands now".)
- [x] With Begins Following on, the entity is Following on the first turn and moves with the player's first move; with a Strict row at the start, it still follows. ("begins Following and moves with the player…", "begins Following on a Strict row".)
- [x] With two weighted Starts, the entity follows only in a game that rolled the Start with the setting. ("follows only in a game that rolled the Start with the setting".)
- [x] A row on such a Start that names a place out of reach of the real start is skipped in play. ("skips a row place the real start cannot reach".)
- [x] The setting does not render for a Group or for a Start at a fixed location, and changing the place away from Player's Starting Location clears it. (`RoutineTab.test.tsx` "the player's starting location" block; preview frame below.)
- [x] A Group's presence at Player's Starting Location begins beside the player and never follows. ("runs a Group presence from beside the player…".)
- [x] A save and load keeps the resolved place and the follow state. (`GameplayContext.positions.test.tsx`: round trip, plus the older-save fallbacks.)
- [x] `docs/World-Editor-Entities.md` and the world format doc describe both. One changelog entry. (`WorldFormat.md` Starts table; fragment `npc-schedules-17.md`.)

## Landed

**Not verified**

- None of the criteria. The engine, save and Routine tab behavior is covered by tests; seven mutations each turned the expected test red.

**For you**

- For you: start a new game in a world with a companion set to begin Following, and check the first narration treats them as with you.
- Routine tab with a start at the Player's Starting Location: `.scratch/npc-schedules-17/frames/routine-player-start.jpg`. Check the picker entry name and "Follows the Player" read well.
- Edge cases kept as built, say if any should change:
  - A Locations pick-mode click on the canvas still sets an Individual's first start to the clicked location. On a start at the Player's Starting Location this replaces it and clears Follows the Player. The Routine view's Generic click never touches such a start.
  - A start rolled again mid-game (the saved one was deleted) with Follows the Player joins the player Following, the same as the older-save load.
  - A New Game with no starting location places nobody at the Player's Starting Location; a reload of that save resolves it to page one's location.
