# Answer Cap and Reasoning Room

Status: ready-for-agent
Spec session: reasoning-answer-split — spec

## Problem Statement

A player who turns on Native Reasoning gets cut turns. One number, the request's `max_tokens`, holds both the thought and the answer. A long thought reaches that number first. The server then stops the reply in the middle of the thought:

- The answer is empty or cut.
- The model makes no tool call, because it never finished planning one.
- The half-finished thought goes forward as if it were complete, into the next tool round or the next request.

Max Output was meant as a loose limit on turn length, a stop-gap the model seldom reaches. With reasoning on, it became a hard limit on thinking. A live probe on LM Studio confirmed the failure: with `max_tokens` 150 and no budget, the model spent 147 tokens on its thought and returned an empty answer with `finish_reason: length`.

The Reasoning Budget slider also sits too low. It runs 5–150% of Max Output, and ships at 40% for narration and 25% for other prompts. In the author's tests, reasoning needs more tokens than the answer.

## Solution

Split the one cap into two limits with different jobs:

| Limit | Job | Where it applies |
|---|---|---|
| **Answer Cap** | Keeps the answer to a loose length. This is the job Max Output always had. | Client side. The app counts answer text only, and stops the reply when the answer passes the cap. |
| **Thought Ceiling** | Guards against a runaway thought. A normal thought never reaches it. | On the wire, as `max_tokens`, on endpoints that take no reasoning budget. |

On endpoints that take a reasoning budget (the server closes the thought at the budget and then writes the answer), the Reasoning Budget stays the real control, as today.

For the player:

- **Settings shows no new controls.** **Max Output Tokens** and each prompt's **Max Output** now cap the answer only, and their help lines say so.
- The **Reasoning Budget** slider runs **50–200%**. Narration ships at **150%**, every other prompt at **75%**. The slider still appears only where the endpoint takes a budget.
- In play, a long thought finishes, tools run, and the answer is written. A long answer stops at the cap and ends on its last full sentence instead of mid-word.
- A thought that the server cuts before any answer is never passed on. The request fails with the existing error, instead of an empty success.

## User Stories

### Player with reasoning on

1. As a player, I want the model to finish its thought before it answers, so that my turn is not empty.
2. As a player, I want the model to finish planning a tool call, so that the narrator looks up the entities the scene needs.
3. As a player, I want a turn to keep about the same length it had before, so that turning reasoning on does not change the story's pace.
4. As a player, I want an answer that runs long to end on a full sentence, so that the turn does not stop mid-word.
5. As a player, I want a cut thought to show as a failed turn, so that I can retry instead of reading an empty or broken turn.
6. As a player, I want a cut thought kept out of later requests, so that no later step builds on half a plan.
7. As a player on an endpoint that sends its reply all at once, I want the same answer length as a streaming endpoint, so that the endpoint type does not change the story.
8. As a player on a cloud endpoint, I want the model to think as long as it needs, so that reasoning is worth turning on.
9. As a player on the local engine or LM Studio, I want the Reasoning Budget to keep closing the thought at the budget, so that I control how long the model thinks.
10. As a player in Inline thinking mode, I want the narration's own `<think>` block kept out of the answer count, so that the inline thought does not use the answer's room.

### Player adjusting settings

11. As a player, I want **Max Output Tokens** to say that it caps the answer only, so that I know reasoning does not use it.
12. As a player, I want a prompt's **Max Output** override to cap that prompt's answer only, so that the override means the same thing as the endpoint setting.
13. As a player, I want the Reasoning Budget slider to start at 50%, so that I cannot set a budget too small to finish a thought.
14. As a player, I want the slider to reach 200%, so that I can give reasoning twice the answer's room.
15. As a player, I want narration to ship at 150%, so that the default narration thought has room to finish.
16. As a player, I want the other reasoning prompts to ship at 75%, so that planning and memory passes have room without a long wait.
17. As a player, I want the slider readout to keep showing the percent and its token result, so that I can see what the percent means.
18. As a player with a preset saved below 50%, I want the preset to load and use 50%, so that an old value does not bring the cut thoughts back.
19. As a player on an endpoint that takes no budget, I want no Reasoning Budget slider, so that I do not see a control that cannot work there.

### Preset sharer

20. As a player who shares a prompt preset, I want budget values up to 200% to survive export and import, so that the preset I share behaves the same for the receiver.
21. As a player who imports an older preset, I want its budget values to load without errors, so that old shares still work.

### Developer and probe author

22. As a developer, I want the AI Request Spec to carry the Answer Cap, so that the AI Stream and the tool loop can enforce it without reading settings.
23. As a developer, I want the context reserve to keep its current size, so that the Thought Ceiling does not shrink the history room.
24. As a developer, I want the length guidance to read the Answer Cap, so that the prompt tells the model the same length the client enforces.
25. As a developer, I want the AI Context viewer to show the `max_tokens` that was sent, so that I can see the Thought Ceiling on a real request.

## Implementation Decisions

- **Terms.** *Answer Cap*: the resolved cap on answer text for one call (the prompt's Max Output override, else the call's own cap, else the endpoint's Max Output). This is today's `answerCap`. *Thought Ceiling*: the `max_tokens` sent to an endpoint that takes no reasoning budget while reasoning is on.
- **Which endpoints take a budget.** The existing capability test decides this: the resolved reasoning capability says the target takes a budget, and its dialect takes one. The Settings slider already uses this test. No per-dialect list is added.
- **Wire caps (AI Request Spec).**
  - Reasoning off, or the model is ruled out: `max_tokens` is the Answer Cap, as today.
  - Reasoning on, the target takes a budget: `max_tokens` is the Answer Cap plus the budget, as today. The server closes the thought at the budget.
  - Reasoning on, the target takes no budget: `max_tokens` is the Thought Ceiling, which is the Answer Cap plus the budget at the maximum slider value (200% of the endpoint's Max Output). A fixed size keeps the guard bounded and predictable.
  - The rule is "no budget on the wire → Thought Ceiling," not "the target takes no budget." A budget-taking target that sends no budget (for example, no base and a floor of 0) gets the ceiling too (ruling Q-C, ticket 03).
  - "Reasoning on" means the model will reason on this request: the resolved effort is not `none`, or the endpoint refuses off (ruling R1, ticket 03). An unprobed endpoint that is sent no reasoning field keeps the Answer Cap, because nothing says it reasons (ruling R2, ticket 03).
  - Inline narration sends the ceiling too, because its `<think>` block is in the answer text and would otherwise use the answer's room on the wire (ruling R3, ticket 03; user story 10).
  - With an Answer Cap but no base (the endpoint's Max Output override is off), the Answer Cap stands in as the base: the ceiling is the Answer Cap × 3 (ruling Q-A, ticket 03).
  - With no Answer Cap and no base, nothing changes: no `max_tokens` is sent.
- **AI Context viewer.** A separate chip beside the reasoning chip, in the same muted style, shows the sent `max_tokens` (label "Max Tokens 1,200", tip `max_tokens: 1200`). The debug endpoint info carries the value, so bug reports include it. No chip when the body sent no `max_tokens`. It is separate because `max_tokens` is sent with reasoning off too (ruling Q-B, ticket 03).
- **The AI Request Spec carries the Answer Cap** as its own plain value, next to the body. The AI Stream and the tool loop read it from there.
- **Context reserve and length guidance** read the Answer Cap plus the budget at the prompt's own percent, which is today's number. They do not read the Thought Ceiling. So the history room does not change.
- **Answer Cap enforcement (client side).** The tool loop counts answer text with the app's existing token estimate. Reasoning events do not count. When the count passes the Answer Cap, the loop aborts the request. On narration, it trims the answer to its last sentence end; if the text has no sentence end, it keeps the cut text. Every other kind keeps the raw cut text, because a sentence trim means nothing for JSON or lists (ruling Q1, ticket 02). The result carries `finish_reason: length`, so downstream code treats it the same as a server cap today. It must not read as a player cancel (`aborted`).
- **Buffered endpoints.** The count runs on answer events whenever they arrive. An endpoint that sends every event at once goes through the same code, and the trim still applies. Only the early abort has no effect.
- **Leading reasoning blocks.** On any call, a leading reasoning block in the answer text (`<think>`, `<thinking>`, `<reasoning>`, `<thought>`) does not count, because the app strips that block from every reply. The count starts after the block closes. A block that never closes gets no client cap; the server `max_tokens` still applies (ruling Q2, ticket 02).
- **Cut thoughts.** A round that ends with `finish_reason: length` before any answer text and with no tool call has a cut thought. The loop does not carry that reasoning into a later round or request. The request fails through the existing request-failure path. This applies to both a Thought Ceiling hit and a server cap hit.
- **Budget range.** Minimum 50%, maximum 200%, step 5. Defaults: narration 150%, every other kind 75%. Only narration and the seven Low-reasoning kinds (`thinking`, `director`, `character`, `storyboard`, `summary`, `milestoneSelect`, `diary`) reason by default. The 75% default also applies to the other kinds when a player turns reasoning on for them.
- **Stored values.** No field changes. A stored percent below 50 clamps to 50 at read, through the existing clamp. The share sanitizer clamps to the new maximum of 200. There is no migration and no export-shape change.
- **Copy.** The endpoint's **Max Output Tokens** help line and the prompt's **Max Output** help line say that they cap the answer, not reasoning. The Reasoning Budget info line keeps its "in addition to the answer" meaning and its "above 100%" sentence.

## Testing Decisions

A good test drives one seam from the outside and asserts what a player or the server would see: the request body sent, the text and finish reason returned, or the control rendered. A test does not read internal helpers or mirror the percent math. Each guard test must fail when its bug is put back (the `test-bar` skill).

- **AI Request Spec: `buildRequestBody` and `outputCaps`.** Prior art: the reasoning and cap cases in the existing AI Request Spec tests.
  - Budget-taking target: `max_tokens` is the Answer Cap plus the budget, and the budget field is sent.
  - No-budget target with reasoning on: `max_tokens` is the Thought Ceiling.
  - Reasoning off: `max_tokens` is the Answer Cap.
  - `outputCaps` returns the Answer Cap plus the budget at the prompt's percent, not the ceiling.
  - The spec carries the Answer Cap.
- **Tool loop over a fake SSE fetch.** Prior art: the existing tool-loop and AI Stream tests with their streaming-response helper.
  - Answer events past the Answer Cap abort the request, trim to the last sentence end, and finish with `length`.
  - Reasoning events of any length do not count toward the Answer Cap.
  - All events arriving in one chunk give the same trimmed text.
  - A round that ends on `length` with reasoning only fails, and its reasoning is absent from any later request body.
  - A tool round whose thought finishes still runs its tool call.
  - Inline mode: the `<think>` block does not count toward the cap.
- **Settings modal render.** Prior art: the existing Settings modal reasoning and prompt-options tests.
  - The slider's range is 50–200.
  - A fresh narration prompt shows 150%, and a fresh Low-reasoning prompt shows 75%.
  - A stored 25% shows as 50%.
  - The slider is absent on a target that takes no budget.
- **Preset share.** Prior art: the existing preset share tests. A 200% budget survives export and import, and a 250% budget clamps to 200.
- **Live check (outside the gates).** Rerun the LM Studio probe from this spec's discussion: the budget arm and the cap-only arm. Record the finish reasons and answer lengths in the ticket.

## Out of Scope

- An "Unlimited" position on the slider. Tabled until it is seen as needed. If it returns: one notch past 200% that sends no budget and no `max_tokens`, stored as a sentinel above the maximum so older builds clamp it to 200 (an export-shape change). With the fixed Thought Ceiling, a no-budget notch would cut thoughts sooner than 200%, so it must drop the ceiling too.
- Detecting a thought that the server closed at the budget. The server reports a normal stop, so the app cannot tell that thought was cut. It stays carried as today.
- Endpoints that ignore `stream: true` and return one JSON body. The app has no non-streaming path today. Whether the AI Stream parses such a reply is UNVERIFIED and is a separate issue.
- Testing whether the cloud default endpoint honors a reasoning budget. That decides whether the slider appears there, but the existing capability test already makes that call.
- Tool-call rate on the Experimental prompt. The probe in this discussion showed 1 call in 6 runs, independent of the limits. That is a prompt or model question.
- Any change to which prompts reason by default.

## Further Notes

- Evidence from the discussion (MeroMero 31B on LM Studio):
  - `thinking_budget_tokens` 64, `max_tokens` 400: the server closed the thought at 63 tokens, and the answer was complete (`stop`).
  - No budget, `max_tokens` 150: a 147-token thought, an empty answer (`length`).
  - Experimental prompt with `get_entity` on Sedge Landing, 3 arms × 2 seeds: thoughts ran 125–253 tokens. No arm was cut. The limits in the author's own play are tighter than that fixture.
- The Thought Ceiling makes cloud turns slower when the model thinks longer. That is the intended trade: a complete turn over a fast empty one.
