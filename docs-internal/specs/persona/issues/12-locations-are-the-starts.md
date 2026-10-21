# 12: Locations Are the Starts

Status: ready-for-human
Base: 1b757d529
Blocked by: 06
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

**Parent:** [Persona](../spec.md), ruling Q28.

**What to build:** Drop the persona's **Starting Location** dropdown and the `startingLocationId` field. The Starting Location step lists every location of the picked world persona beside the flagged starts, and preselects the first flagged one, else the first listed. `migrateWorld` drops the shipped key on load.

**Rationale for the model:** two readers and one migration step. A mid-size change with its own tests.

## Acceptance criteria

- [x] `offeredStartLocations` lists the flagged locations plus the picked world persona's locations, in world order. A library pick that shares a world id adds nothing. `personaPick.test.ts`.
- [x] `personaStartLocation` gives the first flagged location among the entity's, else its first location, else null. `personaPick.test.ts`.
- [x] A switch to a persona whose list lacks the current location drops to that persona's start, else Random, and clears the hand pick. `personaPick.test.ts`, `entryDraft.test.ts`, `EnterWorldWorkspace.test.tsx`.
- [x] The picker's "Starts at" line names the preselect for every world persona that has one. `EnterWorldWorkspace.test.tsx`.
- [x] The World Editor has no **Starting Location** dropdown. A persona-marked entity's **Locations** field carries a hint that the player can start at any of them. `EntityFields.locationsHint.test.tsx`.
- [x] `migrateWorld` removes `startingLocationId` from every entity, and leaves an entity without it untouched. `version.test.ts`.
- [x] Emberwatch carries no `startingLocationId`, and both personas still start at Emberwatch Keep. `emberwatchWorld.test.ts`.
- [x] The wiki and World Format describe the list rule and no longer name the dropdown.

## Landed

**Not verified:** none.

**For you:** open Emberwatch in Enter World, pick Albus, and open **Starting Location**. The list should read Random, Emberwatch Keep, Chapel of the Ember, with the Keep checked.
