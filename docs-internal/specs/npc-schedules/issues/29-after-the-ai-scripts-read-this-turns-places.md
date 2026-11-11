# 29: After The AI Scripts Read This Turn's Places

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Not diagnosed. The scripts sweep of 2026-11-11 read the code and found a probable fault; nobody has run it.

The claim: a script that runs After the AI reads entity places, followers and waiting entities as they were at the start of the turn. The script state is prepared from values captured at render time. By the time After scripts run, the turn has already settled who came along and who the narration pulled into the scene, and the narration prompts read that settled state. The player's own location is live. So when the player moves from A to B with a companion, an After script may read the companion at A, and `present` at B without it.

**Reproduce first.** Drive one turn through the mounted game: the player moves with a follower, and a second entity is pulled over by the reply. An After the AI script records `entities.X.location`, `entities.X.following` and `locations.B.present`. Read what it records.

- **If it reads the turn-start state:** fix it so After scripts read what the turn settled (Q212), the same state the narration prompts of that turn read. Check the same for World Tool and User Tool calls made during the turn, and for a reroll, and fix what shares the cause.
- **If it already reads the settled state:** keep the test as a guard, change no code, and say so in the landing.

In both cases the Scripts Reference must say what each timing reads. Today it says only that prompts in the same turn read the entities at their earlier locations. State, per timing, whether entity places are from before or after the turn's moves. The engine's end-of-turn placement is not visible to After scripts; say that too.

Reproduce in a real run before reasoning from the source. Do not rebuild the help vectors. Ticket 32 does that once.

Spec rulings: Q212, Q53, Q90.

## Acceptance criteria

- [x] A test drives the turn above through the mounted game and asserts what the After script reads for the follower and for the pulled entity. `GameViewer.afterScriptPlaces.test.tsx`, first case: Bram follows, Maela is told to wait, Asha is called over.
- [x] The landing states the observed values before any fix, and whether the fault was real. See Landed.
- [x] If real: After scripts read the settled places, followers and waiting entities, and the test fails with the fix removed. Mutation: without the After book, `ashaAtWell` and `wellHasAsha` read 0.
- [ ] Before the AI and At Game Start scripts read the same values as before this ticket. Before the AI: the first case's `before` script reads Maela following and Asha at the hut. At Game Start: by inspection only.
- [x] The landing says what Tool calls and a reroll read, with the evidence, and what was fixed or left. See Landed; the Q220, Q219 and Q227 cases.
- [x] The Scripts Reference states, per timing, which entity places a script reads. New "Where Each Timing Reads Entities" table under Moving Entities.

## Landed

**Before the fix (observed):** the After script read Bram at the Well and following (correct only because a follower reads the player's live location). It read Maela as following, not waiting, and in `present` at the Well. It read Asha, called over by the reply, at the Hut and not in the Well's `present`. The fault was real. The game itself settled Maela waiting and Asha at the Well; only the script read was stale.

**Cause:** `prepareStatCode` read positions, followers and waiting from its render closure, and the turn's commit calls it from the render the turn started in.

**Fix:** scripts read a turn book when one is set, else the live book (`currentBook()`):
- Tool calls and During AI Output: the join once the move is known (Q220). Test: the Q220 case reads Maela waiting, Bram following, Asha not yet at the Well. A move the narration describes is known only after the narration.
- After the AI and the commit's item scripts: the Inventory pass's book, moves plus pulls (Q218, Q227). Test: the Q227 case: an After script sends Maela to the Hut, and the When Gained script still reads her waiting.
- Re-roll: the live book, end-of-turn placement included (Q219). Test: the Q219 case moves Asha home between the turn and the re-roll; the re-roll reads her at the Hut.
- The in-game Tool fallback (used only when `prepareStatCode` throws, its one null path) lays the live book over the opening state.
- On the opening turn and a turn with an untaken suggested move, the Inventory pass's book already holds end-of-turn placement, so After reads it there (Q226). The Reference names both.

**Not verified**
- At Game Start reads: no test. It runs before any join, with the ref cleared at turn start, so it reads `currentBook()` as the turn began.
- The Tool fallback path: no test. It runs only when the state build throws.
- Coverage was not measured; `GameViewer.tsx` is covered here only through the mounted tests above.

**For you**
- Play a turn where a companion follows you and someone the story names joins you, with an After the AI script that checks `location.present`. The companion and the newcomer should both be listed.
