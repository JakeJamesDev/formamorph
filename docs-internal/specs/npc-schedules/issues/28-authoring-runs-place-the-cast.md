# 28: Authoring Runs Place The Cast

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Test Code, the Test Bench script check, the sample Tool snapshot and the Tool lists run a script against a state built from the opening. That state has no entity placement. So in an authoring run:

- a Unique entity with a schedule reads as present at every Start place and every row place;
- `location` reads empty;
- a companion that follows from the start reads `following: false`;
- an entity that begins at Player's Starting Location is present nowhere.

In play each of these has one place, and the companion follows. An author who tests a script sees results the game never gives.

Give authoring runs a sample placement: the cast as the opening places it, at the opening hour. A Unique entity stands at its first Start, a Generic entity at all of its Starts, an entity at Player's Starting Location at the opening's location, and Follows the Player holds. The Test Bench AI context already places the cast this way; use that placement, do not write a second one.

The Scripts Reference says an authoring run gives an entity "every location it lists" and that "no entity has a position". Replace that with the rule above, and say that the sample uses the first Start where play rolls one.

For script tests on entities with a kind, reuse the fixture of ticket 27 when it has landed; otherwise use the position engine tests' fixtures. Do not add a third.

Do not rebuild the help vectors. Ticket 32 does that once.

Spec rulings: Q210, Q147, Q148, Q160.

## Acceptance criteria

- [x] In Test Code, a Unique entity with a schedule reads one `location`, and only that location lists it in `present`. `authoringPlacement.test.ts` "places each entity once in Test Code".
- [x] A companion with Follows the Player at Player's Starting Location reads `following: true` and the opening's location. Same test.
- [x] A Generic entity is present at each of its Starts and nowhere else. Same test: the Herd is at Barn and Field only, where its Starts' schedules put it at the start of the story.
- [x] The Test Bench script check, the sample Tool snapshot and the Tool lists read the same placement as Test Code. One test per caller in `authoringPlacement.test.ts`; each went red with its caller reverted to `openingStateOf`.
- [x] The Test Bench AI context still gives the same cast as before this ticket. `openingCast` calls the extracted `openingBook` unchanged; "keeps the Test Bench AI context cast" pins it, and the existing `aiContext` and `positionPlay` tests pass.
- [x] The Scripts Reference states the authoring-run rule and no longer says "no entity has a position". Only the authoring-run paragraph changed (Q217).
- [x] The landing lists every caller of the opening state and says which now carry the placement. See Landed.

## Landed

**Callers of the opening state:**

| Caller | Placement |
|---|---|
| Test Code (`statCodeTestRun.ts` `testCodeSnapshotOf`) | ✅ now `authoringStateOf` |
| Test Bench script check (`testBench/scriptCheck.ts` `benchStateOf`) | ✅ now `authoringStateOf` |
| Sample Tool snapshot (`tools/sampleToolSnapshot.ts`) | ✅ now `authoringStateOf` |
| Editor Tool lists, Try It and code test (`WorldEditor.tsx` `editorToolWorld`, through the new `tools/editorToolSnapshot.ts`; `test/toolsListBench.tsx` calls the same) | ✅ now `authoringStateOf` |
| Test Bench AI context (`testBench/aiContext.ts`, `chipValues/authoredScene.ts`) | ✅ already placed; `openingCast` now calls the shared `openingBook` |
| Test Bench Opening instrument (`testBench/opening.ts`) | ➖ unplaced; it reads stats and owners only, its cast comes from `authoredChipScene` |
| Tool runner empty fallback (`tools/toolScript.ts`, `openingStateOf({})`) | ➖ unplaced; an empty world has no cast |
| Play, Enter World (`GameViewer.tsx` `openingFold`) | ➖ unplaced (Q215); New Game rolls its own book |
| Play, in-game Tool fallback (`GameViewer.tsx` `toolScriptSourceRef`) | ➖ unplaced (Q215) |

**Q215, the in-game Tool fallback:** play's own placement exists at that point. New Game sets the book (`setEntityPositions`, `setUniqueStates`, `setGenericStates`) before the first turn. The fallback fires when `prepareTurnStartCode` returns null (a thrown run, at least; the other null paths are not traced), and then reads the opening state with no placement, ignoring the live book. Ticket 29 owns this.

**Not verified:** none.

**For you:**

- No changelog entry: the schedules feature is unreleased. Say if you want one.
- `src/test/positionFixtures.ts` holds the position engine tests' Herd plus a Smith (Unique with a schedule) and a Companion (Follows the Player). Ticket 27 may fold its fixture into this one.
