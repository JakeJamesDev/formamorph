# 10: Real AI Samples

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: judgment work on honest sample picks and on what each context window really keeps.

**What to build:** the scene's side-by-side block shows real, unedited output from the Demo AI and Formamorph AI for one Emberwatch moment, from the same prompt. Each level's line and lit-moment count match what that level's context window really keeps on a typical world, so the road doesn't overstate the difference.

- [x] Several runs per arm on both AIs, from the same state and prompt, captured to `.scratch/`. Spend on the hosted provider stays small, and the session reports it in chat only. 8 runs per arm on 3 moments, in `.scratch/road-samples/real/`; one Formamorph AI run at the later turn returned no text, so that arm has 7.
- [x] The shipped pair is typical output, never the Demo AI's worst. The session offers the user at least two candidate pairs. Three offered; each pick is the run nearest its arm's medians; the user picked the later turn (Q49).
- [x] Each level's line and lit count come from a measured read of how many turns each window keeps verbatim on Emberwatch and a heavier bundled world. The measurement goes in the ticket as turn counts per window, with no costs or budgets. Tables below. No bundled world read is heavier than Emberwatch, so the spec session accepted Slime and a labeled non-bundled world. Rulings Q45 and Q47 set the lines and keep 3/7/12.
- [x] No provider name, cost or budget appears in any tracked file. Read on the branch diff.
- [x] Frame at `.scratch/frames/road-samples-1280.png`. Playwright static frame.

For you: pick the sample pair and approve the level lines, on the scene's dev route.

## Measurement

Turns kept word for word, from the app's own requests at turn 10, and from `buildBandedHistory` for the rest. The Verbatim Turns default sets this, and nothing scales it by level.

| World | Demo AI | Spark | Flame | Beacon |
|---|---|---|---|---|
| Emberwatch | 4 | 4 | 4 | 4 |
| Slime | 4 | 4 | 4 | 4 |
| Fantasy Futanari (not bundled) | 1 | 4 | 4 | 4 |

Story held, in turns, before the first summary drops, at the Demo AI's output reserve. A larger reserve takes about 40 turns off each cell. The sizes come from one real 60-turn Emberwatch run and are extrapolated, so read them as rough.

| World | Demo AI | Spark | Flame | Beacon |
|---|---|---|---|---|
| Emberwatch | 59 | 199 | 606 | 1420 |
| Slime | 78 | 218 | 625 | 1438 |
| Fantasy Futanari (not bundled) | 10 | 119 | 526 | 1340 |

Emberwatch has the heaviest narration prompt of the bundled worlds read: Slime, Veilwood, Rampage, Valentines and Drone are lighter. Sugarscape failed to enter in the probe, so it has no reading.

The road's 3/7/12 has a ratio of 1:2.3:4, below the measured 1:3 and 1:7 on Emberwatch, so it doesn't overstate the difference.

## Landed

**Not verified**

- The real Formamorph AI path, which Q48 asks for. It needs the server and a pledged account. Its sample is a replay of the app's real request sent directly to the same model with `reasoning_effort: "none"` added, so it is a replay with a changed field. The Demo AI sample is a replay of the real request, unchanged. The spec session had this before the Q49 pick.
- A release build. The real play ran on a dev server with no `.env.local`.
- Why the user had not seen this much dialogue from the Demo AI.

**For you**

- For you: pick the sample pair and approve the level lines, on the scene's dev route. The pair is picked (Q49); the lines, headline, subline and perks are drafts to approve at `#dev?view=mainMenu&modal=road&tab=supporter_plus`.
- Approve the "Your Action" label over the samples.
- The subline says every level adds more turns, and Spark's line names no turns. Check that they read together.
- How large the gap looks: moderate. The Demo AI stays abstract, and Formamorph AI is more concrete and uses more of the character and the world. Word counts are close. See `.scratch/first-time-flow-10/frames/road-samples-1280.png`.
- A heavy world holds less story on one level: Fantasy Futanari holds 119 turns on Spark against Emberwatch's 199, the case the copy names.

**Findings for a ruling, not fixed here**

- A. A real narration request carries only model, messages, max tokens and stream. Narration has no sampler pin, and a custom endpoint omits unpinned samplers, so each AI uses its own server default temperature.
- B. Every action, silent ones too, carries the line asking for quoted speech. Formamorph AI's dialogue follows the action: about 50% on a question, 23% on a silent action, 41% on a press. The Demo AI varies less: 33%, 37%, 26%.
- C. The choices pass skews play toward questions: 1 of 10 played actions was truly silent.
- D. The server's allow-list strips `reasoning_effort`, and the model entry's `reasoning` setting decides what players get. With no reasoning field, one of 6 replies returned reasoning text and one did not end in stop.
- A tutorial popover and a world-update toast can draw over the scene on a fresh profile's dev route. Not read in the real flow.
