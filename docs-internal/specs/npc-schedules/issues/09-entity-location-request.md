# 09: Entity Location Request

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A prompt change: it ships with probe numbers.

## What to build

The request that decides who moves with the player is reworked.

- It is sent for each follower, and for each Individual at the player's place whose current row is not Strict. Never for a Group. It runs only while location routing is on, as today.
- **Replies are a closed list.** For a non-follower: Come along, or Stay. For a follower: Keep following, Wait here (about an hour, until the end of this daypart, or until the end of the next daypart), or Part ways. "Go to a place alone" stays, limited to the character's allowed places.
- A follower told to wait stays where they are until the time runs out, then goes back to their routine. Part ways sends them back at once.
- A follower who cannot enter the player's next place stays behind and waits until the end of this daypart.
- The reply is a JSON schema with a text fallback, chosen per endpoint the way the Inventory pass does. The reply format sits after the user message, outside the author's prompt.
- The request's context carries the current time and daypart.
- The sampler pins add repetition penalty 1.
- In auto mode the request runs before narration and sees only the action. Suggest mode also reads the narration.

One call per character stays the default. A probe decides whether one batched call replaces it. The bar: an action that names one character, with two others present, moves only the named one.

Ticket 03 left an interim request in place (Q94): today's four replies, a narrowed subject list, and a Go to that offers only the current row's places among neighbors. This ticket replaces all three. Widening Go to to every allowed place changes the prompt, so the probe covers it.

Read `docs-internal/notes/prompt-writing-guide/notes.md` before writing the prompt.

Spec rulings: Q3, Q4, Q8, Q16, Q27, Q36, Q42, Q49. Stories 43–52, 59–61. The spec's "Entity location request" section is the contract.

## Acceptance criteria

- [x] Turn pipeline tests with recorded replies cover both reply forms (schema and text fallback), each reply for a follower and for a non-follower, each wait duration, the wait cap, and a reply that names a place that is not allowed (refused). `turnPasses.test.ts` "the entity location request" (both forms, every line, unoffered place → null); `computeTurnCommit.test.ts` "a follower told to wait or part ways"; `entityFollowing.test.ts` "waits each offered length" (cap).
- [x] A Strict character at the player's place gets no request, and neither does a Group. `entityFollowing.test.ts` "never asks a Group or a character on a Strict row"; mutation of the Strict filter goes red.
- [x] No request runs while location routing is off. Existing `planTurn.test.ts` gate cases (unchanged gate, Q27).
- [x] A follower crosses a Far link with the player. A follower whose Traversable does not allow the next place stays and waits. `computeTurnCommit.test.ts` "crosses a Far link with the player (Q49)" and "waits where it stood at one it does not".
- [x] A waiting follower returns to their routine when the wait ends, and at once on Part ways. `computeTurnCommit.test.ts` "waits where it stood until the wait ends…" and "goes back to its routine at once on Part ways"; `entityFollowing.test.ts` covers Q106 (stays in the scene until the player leaves).
- [x] The request body carries the time, the daypart and the pinned samplers. A test reads the body. `GameViewer.narratedMoves.test.tsx` reads the sent body: time line, `temperature: 0.15`, `repetition_penalty: 1`, `entity_move` schema.
- [x] Probe numbers on the cloud default, with in-batch controls, for wait durations read from the action and from narration, and for the batching bar. The landing states the numbers and the batching decision, and the request count per turn. See Landed.
- [x] The prompt has no example value a small model can copy. The time and wait ends are live values (Q107); no sample names or times.
- [x] The prompt reference doc and a changelog fragment cover the change. `docs/Prompts.md`, `docs/Prompt-Chips.md` (Q108), fragment `npc-schedules-09.md`.

## Landed

**Probe** (`testing/baseline/harness/entity-location-probe.cli.ts`, cloud default, 8 runs × 18 cases, Emberwatch at 14:00; every arm in one dispatch per case):

| Arm | Lines | Right | False move | Wrong wait | Named-only (bar) |
|---|---|---|---|---|---|
| New prompt, per character | 504 | 91% | 24 | 15 | 16/24 |
| Old prompt text, same lists (control) | 504 | 88% | 24 | 32 | 8/24 |
| One batched call | 504 | 97% | 0 | 16 | 24/24 |

- Wait from the action 91% vs control 87%; from narration 93% vs 92%.
- A second batch (a reworded prompt vs this one as control) scored 88% vs 91%, so the shipped text stayed. Batched again met the bar, 24/24.
- After the hour line gained its daypart: wait cases 96%, hour cases 100%.
- Known misses, per character: "as long as it takes" and "until night falls" pick the end of this daypart, not the next (8/8 and 7/8). "Corvin, come with me" also brings Sylvie and Wenna (8/8 each). Batched gets the second right.
- **Requests per turn:** one per follower plus one per non-Strict Individual at the player's place: 4 at the probe's tavern, plus the router. Batched would be 1.
- **Batching decision (Q103):** per character stays the default. A batched call meets the bar (24/24, both batches) and per character does not (16/24), so the switch is a follow-up ticket. Batched calls ran about 2× the latency of one per-character call.

**Not verified**

- Cydonia was not run: cloud only, by the project default.

**For you**

- For you: ask a companion to wait "till ten", and to part ways, and check the story and the game agree.
- Ask a companion to wait "as long as it takes": the probe says they will likely wait only to the end of this part of the day.
