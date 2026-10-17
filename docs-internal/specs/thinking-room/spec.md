# Spec: Thinking Room

Status: done
Status note: Closed 2026-10-15. Tickets 01–06 landed, last landing b310f9eea; review fixes in c9ab17f24. Gates green on 2026-10-15 (run at 42fd19d72).
Spec session: thinking-room — spec

## Problem Statement

Two players report the same error: "The model reached its token limit before it wrote an answer."

- **Too little room.** A player on Novita uses `zai-org/glm-5.3-flash`. That model always reasons and ignores the off switch. Formamorph gives a call with no budget field a Thought Ceiling of Answer Cap + 200% of the endpoint's Max Output. With Max Output off, the base is the call's own cap. Location Change gets 11 + 22 = 33 tokens. The model spends them all thinking and never answers. Turning Max Output off made it worse.
- **Too much room, no end.** A player on a local llama.cpp server runs a model that reasons. Director and Thinking ship on at Low. The llama.cpp record takes no budget, so nothing tells the server when to stop thinking. The Thought Ceiling is 18,432 tokens. The thought falls into a repetition loop, runs to the ceiling, and no answer arrives.

The same rule causes both failures. The Thought Ceiling grows with the answer's cap and with Max Output. Neither number says how long a thought needs.

## Solution

A call that reasons with no budget on the wire gets a fixed **Thinking Room**. The prompt's strength sets the size, not its answer cap and not Max Output. The request sends `max_tokens` = Answer Cap + Thinking Room.

| Strength | Thinking Room |
|---|---|
| Minimal | 128 |
| Low | 1,024 |
| Medium (and Model Default) | 2,048 |
| High | 4,096 |
| Extra High | 8,192 |
| Max | 16,384 |

The sizes follow LiteLLM's effort ladder.

- **llama.cpp ends the thought itself.** Formamorph sends the Thinking Room as `reasoning_budget_tokens`. At the room, the server forces the end of the thought, and the model writes its answer.
- **llama.cpp's off switch works on every template.** A switched-off prompt sends `reasoning_effort: "none"`.
- **Servers that cannot end a thought keep the cut.** The cut-thought error now says the model used all its thinking room, and Error Details name the room and the strength.
- **Inline narration** sizes its `<think>` room the same way, from narration's strength.
- **Budget targets with Max Output off** send the Thinking Room as their budget, instead of no budget.
- **The player sees the room.** Where no budget slider shows, a token readout sits beside the strength, such as "Low · 1,024 tok".

## Rulings

Settled in the grill on 2026-10-14. Research: `docs-internal/notes/multi-endpoint-reasoning/` (summary in its `notes.md`).

1. **Q1 Scope.** The Thinking Room applies to a call that carries reasoning (a reasoning field goes out, or the record knows the model reasons) and sends no budget. A record that knows nothing and sends nothing keeps the Answer Cap alone.
2. **Q2 Size source.** The prompt's resolved strength sets the size. Model Default counts as Medium. No new control.
3. **Q3 Max Output.** Max Output caps the answer only. The room goes on top. The Answer Cap stays client-side, so a long room never lengthens an answer.
4. **Q4 Overflow.** A server that cannot end a thought mid-stream keeps the cut-thought error. No retry. The error states the cause.
5. **Q5 llama.cpp off.** A llama.cpp target sends `reasoning_effort: "none"` for every switched-off prompt, on any template. Other levels still go out only where `/props` reports `supports_reasoning_effort`.
6. **Q6 llama.cpp end (revised after research).** A llama.cpp target sends the Thinking Room as `reasoning_budget_tokens`. The server ends the thought. `max_tokens` stays as the backstop. `reasoning_control` and `reasoning_end` are not used.
7. **Q7 Edges.** Inline narration and budget targets both join this effort.
8. **Q8 Sizes (revised after research).** Low 1,024, Medium 2,048, High 4,096.
9. **Q9 Inline narration.** Narration's own strength sizes its room. Global follows the endpoint's level.
10. **Q10 Budget targets.** The budget slider (a percent of Max Output) works as now when Max Output is set. With Max Output off, the Thinking Room is the budget.
11. **Q11 Readout.** A target with no budget slider shows the room beside the strength dropdown.
12. **Q12 llama.cpp UI.** Superseded by Q19. llama.cpp has no budget slider. The strength sizes its room, and the server enforces it.
13. **Q13 Slider with Max Output off.** On a budget target with Max Output off, the readout replaces the slider and its "no base" note.
14. **Q14 Old llama.cpp builds.** A build that ignores `reasoning_budget_tokens` falls back to the `max_tokens` cut. Nothing tells the player; the debug log records it.
15. **Q15 Full ladder.** Minimal 128, Extra High 8,192, Max 16,384, exactly as LiteLLM.
16. **Q16 llama.cpp levels (user, via ticket 03).** `/props` answers `levels: ['none']` on a template without effort support, since llama.cpp takes `none` on every template. The record is then not ruled out, so Q5's off and the room go out before any reply proves reasoning. The switch shows on those templates, with Model Default as the only strength. Known cost: a llama.cpp model that never thinks also gets the room in its `max_tokens` and context reserve.
17. **Q17 llama.cpp off everywhere (user, via ticket 03).** When reasoning is engaged nowhere, a llama.cpp target still sends `reasoning_effort: "none"`, not `reasoning_budget_tokens: 0`. Other dialects and plain endpoints keep today's bodies. Ticket 06.
18. **Q18 No new probe (user, via ticket 06).** Q17 applies where the record already names the llama.cpp dialect (cached, or resolved because a Tool was offered). With reasoning engaged nowhere the capability probe stays skipped, so a never-probed llama.cpp endpoint sends nothing, as today.
19. **Q19 llama.cpp slider (user, 2026-10-16, after a player report).** Supersedes Q12. llama.cpp takes the Reasoning Budget slider like every budget target: a percent of Max Output, and the strength's Thinking Room with Max Output off (Q10, Q13). The server still ends the thought at the budget. Evidence: on a template without effort support, Q16 left Model Default as the only strength, so the player could not raise a room their model outgrew.

## User Stories

1. As a player on an always-on reasoner, I want small background calls to have room to think, so that Location Change and similar passes return an answer.
2. As a player on Novita with `zai-org/glm-5.3-flash`, I want turning Max Output off to leave thinking room intact, so that removing a limit never makes calls fail.
3. As a player on a local llama.cpp server, I want a looping thought to end at a fixed point, so that the model still writes its answer.
4. As a player on llama.cpp, I want switching a prompt's reasoning off to actually stop thinking, so that the off switch means what it says on every template.
5. As a player, I want the room a prompt gets to follow the strength I picked, so that Low means a short thought and High a long one.
6. As a player, I want Model Default to give a sensible middle room, so that I don't have to pick a strength to get working calls.
7. As a player, I want my Max Output setting to keep limiting answer length only, so that thinking never eats the answer's room.
8. As a player, I want to see how many tokens a prompt may spend thinking, so that I understand cost and speed.
9. As a player, I want the readout to update when I change the strength, so that I see the effect of my pick.
10. As a player on a budget target with Max Output off, I want the readout in place of a dead slider, so that the screen shows what the call will actually do.
11. As a player on a budget target with Max Output set, I want the budget slider to keep working as before, so that my tuning stays.
12. As a player whose model ran out of thinking room, I want the error to say so plainly, so that I know the cause is the room and not a crash.
13. As a player reading Error Details, I want the room and the strength listed, so that I can raise the strength or report the numbers.
14. As a player on an old llama.cpp build, I want calls to behave as before rather than break, so that updating Formamorph never makes my server worse.
15. As a player using Inline narration, I want its `<think>` block to get room from narration's strength, so that inline thinking follows the same rule as native thinking.
16. As a player on a model that refuses off, I want a switched-off prompt to get the room of its kept strength, so that the forced thought has space.
17. As a player on Minimal, I want a very short room, so that I can trade quality for speed on purpose.
18. As a player on Max, I want a long room, so that hard passes can think at length.
19. As a player, I want plain endpoints with no reasoning to be unaffected, so that this change costs nothing where it does not apply.
20. As a player whose reports led to this, I want both reported failures fixed by one rule, so that the next model with the same behavior works too.
21. As a developer, I want one table that maps strength to Thinking Room, so that every path reads the same sizes.
22. As a developer, I want the Thought Ceiling to be Answer Cap + Thinking Room everywhere it applies, so that no path still scales with Max Output.
23. As a developer, I want llama.cpp to be its own dialect row, so that its budget and off spellings live in the dialect table and not in the builder.
24. As a developer, I want the context reserve to count Answer Cap + Thinking Room, so that the history room matches what the call may produce.
25. As a developer, I want the AI Request Spec to carry the resolved Thinking Room and strength, so that the stream's error can name them without reading settings.
26. As a developer, I want a test that pins Location Change on GLM-5.3 with Max Output off to Answer Cap + 2,048 or more, so that the guard fails if the old formula returns.
27. As a developer, I want a test that pins the llama.cpp body (`reasoning_budget_tokens`, `reasoning_effort: "none"` when off), so that the wire shape cannot drift.
28. As a developer, I want the debug log to note a llama.cpp reply that thought past its room, so that old builds are visible when someone investigates.

## Implementation Decisions

- **Terms.** *Thinking Room*: the fixed token count one strength buys. *Thought Ceiling*: now Answer Cap + Thinking Room, sent as `max_tokens` on a call that carries reasoning with no budget. *Answer Cap* is unchanged. Add Thinking Room to the glossary and update the Thought Ceiling entry.
- **One strength-to-room table** lives beside the existing reasoning budget constants. Model Default resolves to Medium. The resolved strength is the one the request already uses, with the kept strength for endpoints that refuse off.
- **The reasoning resolver** replaces the 200%-of-base Thought Ceiling with Answer Cap + Thinking Room. The same branch covers Inline narration, using narration's resolved strength.
- **Budget targets with no base.** Where a target takes a budget and the endpoint's Max Output is off, the budget becomes the Thinking Room, raised to the dialect's floor. `max_tokens` is Answer Cap + budget. With Max Output set, the percent-of-Max-Output budget stays.
- **A `llamacpp` dialect row.** The llama.cpp capability source names this dialect. The row writes the budget to `reasoning_budget_tokens`, the level to `reasoning_effort` where levels are honored, and off as `reasoning_effort: "none"` on every template. The record marks it as taking a budget sized by strength, so the request sends the room and the budget slider stays hidden. `/props` answers `levels: ['none']` on a template without effort support and the safe set on one with it (Q16).
- **Cut-thought error.** The message states that the model used all its thinking room before it wrote an answer. Error Details add the Thinking Room and its strength beside `max_tokens`. Copy follows STE.
- **Readout.** The prompt's reasoning field shows "‹Strength› · N tok" beside the strength where no budget slider shows. On a budget target with Max Output off, it replaces the slider and the "no base" note. Copy goes through the copy sweep.
- **Old llama.cpp builds.** No detection. A reply whose reasoning ran past the room on a llama.cpp target adds a debug-log line. Nothing shows to the player.
- **No export-shape change.** No stored setting is added or renamed. The budget percent per prompt stays stored and keeps its meaning where the slider shows.
- ADR 0012 holds: the error travels through the call's one sink.

## Testing Decisions

- Good tests drive the public seam with realistic inputs and assert the request that goes out or the error that comes back. They never assert internal helpers.
- **Seam 1: the request builder** (settings snapshot + call → body and `max_tokens`). It covers every size, every wire rule, and both reports:
  - GLM-5.3 Flash on Novita, Location Change, Max Output off: `max_tokens` = 11 + the kept strength's room.
  - llama.cpp, Director at Low: `reasoning_budget_tokens` 1,024 and `max_tokens` = Answer Cap + 1,024; off sends `reasoning_effort: "none"` on a template without effort support.
  - A budget target with Max Output off sends the room as its budget; with Max Output set, the percent budget is unchanged.
  - Inline narration's `max_tokens` follows narration's strength.
  - A plain endpoint with no reasoning is unchanged.
  - Each guard is proven by reinstating the old formula and watching it fail.
  - Prior art: the Novita identity tests and the request-spec tests.
- **Seam 2: the AI Stream** for the cut-thought error text and its Error Details lines. Prior art: the AI text tests.
- **Seam 3: the prompt's reasoning field** for the readout and for the slider swap with Max Output off. Prior art: the existing reasoning field component tests.
- The llama.cpp capability source is covered through the resolver with an injected fetch, as the other native sources are.

## Out of Scope

- Retrying a cut thought, with more room or with reasoning off.
- `reasoning_control` and the `reasoning_end` control request.
- A `reasoning_budget_message` for llama.cpp. Sent empty for now; a probe can decide later.
- vLLM's `thinking_token_budget` for the same no-end problem. Its row already names the field, but it stays as is.
- Detecting always-on models from OpenRouter's `mandatory` flag beyond what the record already reads.
- Changing the budget slider's range or its percent defaults.
- A user setting for the room sizes.

## Further Notes

- The 3.3.0 fix (GLM-5.3 refuses off on Novita) stays. It routes the off pass to the kept strength, which this spec now sizes.
- Its guard test only asserted `max_tokens > 11`. The new tests pin the real number.
- Reporter follow-up after release: the Novita reporter and the llama.cpp reporter on Discord.
- Research found that most clients size the budget as a fraction of the output cap with a 1,024 floor. That fails on our 11-token calls, which is why the room is fixed.
- Minimal's 128 may cut always-on models. That is the trade the player picks with Minimal.
