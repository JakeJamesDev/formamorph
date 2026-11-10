# 09: Entity Location Request

Status: ready-for-agent
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

- [ ] Turn pipeline tests with recorded replies cover both reply forms (schema and text fallback), each reply for a follower and for a non-follower, each wait duration, the wait cap, and a reply that names a place that is not allowed (refused).
- [ ] A Strict character at the player's place gets no request, and neither does a Group.
- [ ] No request runs while location routing is off.
- [ ] A follower crosses a Far link with the player. A follower whose Traversable does not allow the next place stays and waits.
- [ ] A waiting follower returns to their routine when the wait ends, and at once on Part ways.
- [ ] The request body carries the time, the daypart and the pinned samplers. A test reads the body.
- [ ] Probe numbers on the cloud default, with in-batch controls, for wait durations read from the action and from narration, and for the batching bar. The landing states the numbers and the batching decision, and the request count per turn.
- [ ] The prompt has no example value a small model can copy.
- [ ] The prompt reference doc and a changelog fragment cover the change.

For you: ask a companion to wait "till ten", and to part ways, and check the story and the game agree.
