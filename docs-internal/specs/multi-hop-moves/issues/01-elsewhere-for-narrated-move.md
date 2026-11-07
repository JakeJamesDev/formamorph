# 01: Elsewhere for Narrated Move

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a prompt change, one answer in the reply matcher and a new probe set, with no new move path.

## What to build

When the story takes the player somewhere that is not on the list, the game leaves them where they are (Q2, Q9).

- The Narrated Move request gets an Elsewhere answer: the player's body left for a place that is not on the list.
- Elsewhere moves nobody. In Auto mode the player stays. In Suggest mode no move is offered.
- The router keeps NONE and gets no Elsewhere answer.
- The location-narrated probe gains an **unlisted** set: narrations that carry the player to a place that is not on the list (today, any place more than one move away). It runs beside the existing sets on the cloud default model.
- Docs that describe the Narrated Move request and its answers say what Elsewhere does.

## Acceptance criteria

- [x] A Narrated Move reply of Elsewhere leaves the player at the current location in Auto mode, in a turn-runner test with fake replies. `turnRunner.test.ts` "names no place when the story went Elsewhere, even past a listed one"; `GameViewer.narratedMoves.test.tsx` "leaves the player and a follower where they stand when the story went Elsewhere". Both go red with the router matcher put back.
- [x] A Narrated Move reply of Elsewhere gives no move offer in Suggest mode, in a turn-runner test with fake replies. `turnRunner.test.ts` "offers no move when the story went Elsewhere" (`suggestedLocation` null).
- [x] The router's reply rule and its NONE answer are unchanged. The router pass still uses `matchLocationResponse`; `locationMatch.test.ts` "finds a listed place after Elsewhere" holds its rule.
- [ ] Probe numbers on the cloud default model, 10 runs per scene: unlisted at most 10% moved, carried still at least 90% moved, stay still at most the current rate, router controls unchanged. The numbers go in the ticket's `## Landed` section. Carried, stay and controls met; unlisted not met (see Landed).

## Landed

Probe: `location-narrated-probe.cli.ts`, cloud default model, 10 runs per scene, arms in the same batches. "before" is the Base prompt, frozen in the probe.

| Set | reused | before | narrated (shipped) |
|---|---|---|---|
| carried, moves found | 10% | 100% | **100%** |
| stay, false moves | 0% | 12.5% | **12.5%** |
| unlisted, moved | 16.7% | 66.7% | **50%** |
| · beyond 3 moves (3 scenes) | 33.3% | 33.3% | **33.3%** |
| · 2 moves (3 scenes) | 0% | 100% | **66.7%** |
| router controls, right | 97.4% | 60.5% | **60.5%** |

Prompt variants tried (narrated arm, unlisted moved as beyond-3 / 2-move / total; 2-run batches except A):
- A. Elsewhere in the rules and user message only: 100% / 67% / 83% (10 runs: 83%). Carried 100%, stay 12.5%.
- B, shipped. A + a "- **Elsewhere:** any place farther away that is not named above." line under the list + "the last place the body stops": 33% / 67% / 50%. Carried 100%, stay 12.5%.
- C. B with other wording: 67% / 67% / 67%.
- D. Two-part reply `<own words> -> <answer>`: 33% / 17% / 25%, but carried 90% and stay 25%.

The misses name the first listed place on the walk (Market Row, Millbrook, Watch Fort, The Gull's Rest). By the spec session's ruling, B ships and ticket 02 owns the unlisted bar, judged again with route tails.

**Not verified**
- Unlisted at most 10% moved: not met (50%). Ruled to ship; ticket 02 owns it.

**For you**
- In a live Auto-mode turn, a walk to a place more than one move away leaves you where you are, and the next turns are not out of step. Today this holds about half the time on the cloud model (see the table).
