# 29: After The AI Scripts Read This Turn's Places

Status: ready-for-agent
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

- [ ] A test drives the turn above through the mounted game and asserts what the After script reads for the follower and for the pulled entity.
- [ ] The landing states the observed values before any fix, and whether the fault was real.
- [ ] If real: After scripts read the settled places, followers and waiting entities, and the test fails with the fix removed.
- [ ] Before the AI and At Game Start scripts read the same values as before this ticket.
- [ ] The landing says what Tool calls and a reroll read, with the evidence, and what was fixed or left.
- [ ] The Scripts Reference states, per timing, which entity places a script reads.
