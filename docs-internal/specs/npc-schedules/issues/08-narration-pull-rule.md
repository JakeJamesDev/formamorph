# 08: Narration Pull Rule

Status: done
Blocked by: 01, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

When the narration names a character who is not at the player's place, the game brings them over only when all of these hold:

- They are an Individual. Groups are never pulled.
- They stand in a place one Nearby link from the player's place.
- The player's place is allowed for them: their current row uses it, or their Traversable list has it.
- Their current row is not Strict.
- They are neither Following nor Waiting.

The pull no longer looks at siblings and children directly. A pulled character goes back by the engine's hold rule: a Stay-row character when the player leaves, a Wander or Patrol character when its idle runs out.

This fixes the playtest cases: the farrier who was the focus of the scene at the inn now counts as present, and characters seen through a window do not.

Spec rulings: Q23, Q26, Q36, Q40, Q46, Q59, Q61. Stories 35, 39–42, 51. The spec's "Narration pull" and "Reach" sections are the contract.

## Acceptance criteria

- [x] Turn pipeline tests with recorded replies cover: the inn case (a named character next door comes over, and an item change for them lands), the window case (characters only seen are not present), a mention across a Far link (no pull), a Strict character next door (no pull), a Following or Waiting character (no pull), a Group (no pull), and a place that is not allowed (no pull). The inn case is `GameViewer.inventoryPass.test.tsx` "lands a give to a character the narration calls over…" (farrier in the parent place, key lands, survives the stats re-roll). The rest are in `narrationReading.test.ts` `selectVisitorAdditions`.
- [ ] Each refusal is proven by reinstating the old rule. Reinstated the sibling/child reach: the parent, Connection, Far-sibling and inn tests went red. Dropped the Far filter: both Far tests red. Dropped the engine's follow, waiting-only, Strict and allowed-place guards one at a time: the matching test went red each time. All restored and checked by grep.
- [x] A character pulled from a Stay row returns after the player leaves. One pulled from a Wander or Patrol row returns when its idle runs out. `narrationReading.test.ts` "going back" (three tests; Wander and Patrol still held at 60 minutes, back at 121).
- [x] A migrated one-place character that was Free is not pulled to a sibling place until the author adds it to Traversable. "a migrated one-place character that was Free (the window case)", built through `migrateEntityRoutine`, with the Traversable and Anywhere counter-test (Q101).
- [x] The locations wiki page says who can be called over. A changelog fragment covers the change. `docs/World-Editor-Locations.md` "Who Joins the Scene"; `docs-internal/changelog.d/npc-schedules-08.md`.

For you: in a world you know, call someone over from the next room and from across a Far link, and check both read right in the story.

## Landed

**Not verified**

- The Group refusal was not re-proven by a mutation in this ticket. A Group gets no routine, so the pull skips it before any guard; breaking that means changing `castRoutines`, which ticket 03 owns. Every other refusal was.

**For you**

- In a world you know, call someone over from the next room and from across a Far link, and check both read right in the story.
- Inn case in play: a character standing in the place around yours, named in full by the story, should come over and take an item the same turn.
