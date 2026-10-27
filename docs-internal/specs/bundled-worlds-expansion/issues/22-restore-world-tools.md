# 22: Restore World Tools

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q7, Q9; Implementation Decisions › Tools on the cloud model)

## What to build

Rampage and Emberwatch landed without their World Tools because the cloud model spilled native reasoning when a judgment Tool was offered on narration, and the stat pass could not call a Tool under its schema. The app-side fix is on main now: the model's thought channel is handled as reasoning, and the stat pass can call Tools under its schema. After this ticket, a Rampage player sees `log_landmark` record the landmarks the creature destroys, and an Emberwatch player sees `offer_prayer` move Faith at the chapel.

- Lift each Tool from its content ticket's comments: `log_landmark` from ticket 05 (On Call, pins a memory and adds 5 Destruction once per landmark, the enum of landmark names) and `offer_prayer` from ticket 04 (On Call, guarded to the Chapel of the Ember once per story day, +10 Faith and one memory line). Offer each where it calls reliably now: the stat pass first, since the narration exists there and the call is a fact, with narration as the fallback if the stat pass still declines.
- Replay the cases each ticket recorded, with the Tool-spill probe harness that the fix added: a vague opening and a real trigger, 6 to 10 each per prompt. Pass when the Tool calls on the real trigger, stays quiet on the vague opening, spills on neither, and the stat reply stays valid.
- Then the world probe at the Q9 bar for each world, with Tools offered.
- Move `tools` from planned into each world's row. Each world still plays with Tools off (ADR-0013). Scripts follow the house style.

## Acceptance criteria

- [x] Rampage and Emberwatch each ship their Tool, and the shared suite shows `tools` in both rows with the set check green. `bundledWorlds.test.ts` green, `tools` detected in both rows.
- [x] Replay numbers per Tool and prompt are in this ticket's comments: calls on the trigger, calls on the vague opening, spills, valid stat replies. Stat pass only, since both Tools ship there; see Comments.
- [x] The world probe shows no structural regression and a win or tie for each world at 5 or more runs per arm, numbers in the comments. 8 runs per arm: Rampage tie 4.81 / 4.81, Emberwatch win 4.50 / 4.13.
- [x] Per-world tests cover each Tool handler's write and are shown to bite. `the log_landmark World Tool` and `the offer_prayer World Tool`; 14 of 14 mutations fail them.
- [x] Fingerprints are regenerated. No changelog fragment. `npm run fingerprints` after the last world edit.

For you: in play on the cloud model, destroy a named landmark in Rampage and pray at the chapel in Emberwatch, and check the memory line appears.

## Landed

**Not verified**

- No playthrough shows a call in the app. The replays run the app's own tool loop on captured stat-pass requests, and the handler tests run the real On Call path. But the world probe's fixed actions never topple a listed landmark or pray at the chapel, and its capture keeps no Tool rounds.

**For you**

- In play on the cloud model, destroy a named landmark in Rampage and pray at the chapel in Emberwatch, and check the memory line appears.
- Rampage: after the fall, Channel 8's top stories name it. Destruction jumps by 5 more than the stat pass alone gives.
- Emberwatch: walk into the chapel first, then pray on a later turn. The stat pass reads the location from before this turn's move, unless Location Auto-Apply is on, so "I walk in and pray" in one turn gets the off-chapel reply.

## Comments

**What changed.**

- **Rampage.** `log_landmark`, On Call, offered to the stat pass. One required `enum` of six landmarks: Ferry Terminal, Spire Tower, Metro Underground, Harborgate Bridge, Neonspire Stadium, Bayline Refinery. Cedar Hollow is a suburb with evacuees, so it is left out. The ticket 05 script, with its Top Stories Object placeholder (two authored stories, `roll: false`) and the chip at the end of Channel 8's AI description. The script's comment says why the same-turn guard reads Top Stories: a memory pin lands at turn end, and a placeholder pin lands at once. The empty-name guard and the lower-case compare are gone, because the app rejects any value off the enum.
- **Emberwatch.** `offer_prayer`, On Call, offered to the stat pass, `callLimit: 1`, +10 Faith per the spec. The ticket 04 script, now with a reply on every branch. A memory added this turn also lands at turn end, so the call limit stops two prayers in one turn.
- **Wording.** Each description says "Call it … before you give the stat changes." With "then give the stat changes", Rampage's trigger called 0 of 8. With "before", it called 6 of 6, and so did Emberwatch's (6 of 6).
- **Readmes.** One World Tool line in each "How this world is built".
- **Tool-spill probe.** It reads the Tool from the world file, takes `--world rampage|emberwatch`, and gains `vague-stat` and `opening-stat` cases. It answers a rejected argument with the app's own error, and counts Accepted calls apart from attempts.

**Replays (cloud `default`, stat pass, strict schema, arms interleaved, 10 per arm).**

| Tool | Case | Arm | Spills | Calls | Accepted | Valid stat replies |
|---|---|---|---|---|---|---|
| `log_landmark` | vague narration | none / tool | 0 / 0 | 0 / 0 | 0 / 0 | 10 / 10 |
| `log_landmark` | captured opening (container cranes) | none / tool | 0 / 0 | 0 / 10 | 0 / 0 | 10 / 10 |
| `log_landmark` | Spire Tower torn down | none / tool | 0 / 0 | 0 / 10 | 0 / 10 | 10 / 10 |
| `offer_prayer` | vague narration (square, chapel in view) | none / tool | 0 / 0 | 0 / 0 | 0 / 0 | 10 / 10 |
| `offer_prayer` | captured opening | none / tool | 0 / 0 | 0 / 0 | 0 / 0 | 10 / 10 |
| `offer_prayer` | prayer at the brazier | none / tool | 0 / 0 | 0 / 10 | 0 / 10 | 10 / 10 |

- On the captured opening, the model tries `"Container Cranes"`, which is off the enum. The app rejects it and nothing is written. A rerun with the app's error answered (10 runs) got 9 attempts, 0 accepted, and no retry with a listed landmark. The cost is one extra round on such a turn.
- Two wordings that tried to cut that attempt failed. "names one of the listed landmarks and shows it fall" still tried the cranes 6 of 6 times. "Other buildings, cranes and vehicles count in the stat changes alone" logged Ferry Terminal falsely 5 of 6 times.
- The stat pass still adds its own Faith for the prayer (+5 in both arms). The Tool's +10 comes on top, as Rampage's bonus does.

**Probe (Q9).** Cloud `default`, worktree against `3bdc7affc` (main, the Tool-free worlds), Tools offered, interleaved, 8 runs per arm. Rubric scored blind by a subagent before the key: grounding, second person present, name discipline, world-fact fidelity, advancement; pass 1, partial 0.5.

| World | Arm | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Stat ok | Flagged | Rubric total / per run |
|---|---|---|---|---|---|---|---|---|---|---|
| Rampage | worktree | 24 | 0 | 0 | 0 | 0 | 24/24 | 24/24 | 0 | 38.5 / 4.81 |
| Rampage | 3bdc7affc | 24 | 0 | 0 | 0 | 0 | 24/24 | 24/24 | 0 | 38.5 / 4.81 |
| Emberwatch | worktree | 24 | 0 | 0 | 0 | 0 | 24/24 | 24/24 | 1 | 36.0 / 4.50 |
| Emberwatch | 3bdc7affc | 24 | 0 | 0 | 0 | 0 | 24/24 | 24/24 | 1 | 33.0 / 4.13 |

- Rampage ties and Emberwatch wins. Emberwatch's gap comes mostly from one old-arm run at 2 of 5, mostly past tense; without it, the arms read 4.50 / 4.43.
- Both arms of Emberwatch share the misses: sea air in an inland valley (four runs) and a wrong Old Watchtower (timber, inside the keep, glass windows).
- The probe's fixed actions never trigger either Tool, so this batch tests the Tools offered without a trigger.
- The Emberwatch arm read the world before the review's readme fold-in, and the Rampage arm read it before the dead guard went. Neither change alters behavior.

**Tests.** `rampageWorld.test.ts`, `the log_landmark World Tool`: the load shape, the pin plus +5 plus the news, once in a turn by the news pin, once across turns by the memory the first call pinned, three falls kept newest first, and the chip in Channel 8's description. `emberwatchWorld.scripts.test.ts`, `the offer_prayer World Tool`: the load shape, +10 with the memory, the plain memory, nothing off the chapel, and one prayer a day by the memory the morning's prayer added. Fourteen mutations, one at a time, each red: the bonus (both worlds), the same-turn guard, the earlier-turn guard, a fourth story, authored stories kept, the place dropped from the memory, offered to narration, the chip removed, the chapel guard, the once-a-day guard, any day counting, the intention dropped, and the call limit removed. Coverage tools can't see code that runs as a script string in QuickJS, so the mutations are the evidence.
