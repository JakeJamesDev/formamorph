# 27: Script Help Matches The Routine

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The script help an author reads in the editor still describes entities as they were before this effort. In play the script calls are correct; only the text and the tests are behind. Found by the scripts sweep of 2026-11-11.

Correct the completion and hover text, and the same statements in the Scripts Reference:

- **`follow`** ends "An entity at every location never follows". The rule now: a Unique entity follows, also past a locked row and Can Also Go (Q64, Q85). A Generic entity never follows (Q28, Q132).
- **`location`** says "empty at every location it lists". A Generic entity in play stands at each of its Starts, not at every place it lists. State what `location` returns for a Unique entity, a follower and a Generic entity.
- **`move`, `follow`, `unfollow`** do nothing on a Generic entity, and nothing tells the author. Say so in each entry.
- **The Opening Location template** moves the player at game start. A move in the opening turn does not change the resolved start (Q165): an entity that begins at Player's Starting Location without Follows the Player stays where New Game seated the player. Say so in the template's description and in the Scripts Reference.

This surface takes the technical register of the Writing Guide. Write from a facts list checked against the executor, not from the spec.

Then add the missing tests. No script-side test uses an entity with a kind and Starts; every fixture is pre-effort. Cover, through the script executor and the turn commit:

- an entity `.move()` on a Unique entity with a schedule: the move holds, and the schedule takes over again when the hold ends (Q53, Q90, Q98);
- `.follow()` on a Unique entity inside a locked row;
- `.move()` and `.follow()` on a Generic entity: no change;
- `location` and `present` for a Unique entity, a follower and a Generic entity.

This ticket owns any shared fixture for script tests on entities with a kind. Tickets 28 and 30 reuse it.

Do not rebuild the help vectors. Ticket 32 does that once.

Spec rulings: Q209, Q28, Q53, Q64, Q85, Q90, Q98, Q132, Q165.

## Acceptance criteria

- [x] The `follow`, `location`, `move` and `unfollow` entries state the rules above, and no entry says "at every location". `statCodeSurface.ts`; `codeSurface.copy.test.ts` green.
- [x] The Scripts Reference states the same rules in its entity tables. Member table, Moving Entities, `present`.
- [x] The Opening Location template description and the Scripts Reference state the opening-turn rule of Q165. Also in `ScriptsGuide.md`.
- [x] `npm run copy:sweep` gives no notice on the changed strings; the hand pass of the technical register is done and named in the landing. Hand pass against "The technical register" of the Writing Guide: "ignored" for a write with no effect, "applies" for a change that takes effect, no image verb ("stands" removed).
- [x] The four test groups above exist and pass. Each guard is shown to fail once with its rule broken. `statCodeTurn.entityKinds.test.ts`, 12 tests; mutations below.
- [x] Any test that pins an old help string is updated. None pinned one; `codeSurface.copy.test.ts` limits (two sentences, 21 words) shaped the new strings.

## Landed

**Mutations (each reinstated, the named tests went red, then restored):**

- Script move without a hold (`moveUniqueByScript`): both hold tests failed.
- Script follow refused on a Strict row (`startFollowing`): both locked-row tests failed.
- A script move placing a Generic entity (`applyEntityCodeWrites`): the Generic move test failed.
- `location` and `present` ignoring presences, and a follower reading empty (`sandboxSnapshot.ts`, `statCodeExecutor.ts`): the follower and moved-presence tests failed.

**Not verified:**

- Can Also Go has no mutation of its own. The locked-row test uses an entity whose Can Also Go is empty, so the follow already passes it; no source line checks Can Also Go on a script follow.
- The help vectors are stale on purpose. Ticket 32 rebuilds them.

**For you:**

- Hover `follow`, `location` and `move` on an entity in a script box, and open the Opening Location template menu: read the new wording.
