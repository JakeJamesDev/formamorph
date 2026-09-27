# Reasoning Budget Base

Status: ready-for-agent
Spec session: reasoning-budget-base — spec

## Problem Statement

A player turns on reasoning for a short prompt, such as Memory Selector. The model starts to think and is cut off almost at once. It has no room for a useful thought, and often no room left for the answer.

The cause is the base of the Reasoning Budget. The budget is a percent of the prompt's own output cap, and the thinking lives inside that same cap. A short prompt has a small cap because its answer is short. Memory Selector sends 300 tokens, so its 25% default gives it 75 thinking tokens. The same 300 tokens must also hold the answer. Summary gets 50, Diary gets 20, and Time Passed gets 3.

This defect also blocks the stat-pass reasoning spill fix. The stat cap is 16 tokens per stat, so no percent gives a useful thinking budget.

A player cannot fix this with one setting. To give a short prompt room to think, the player must raise its Max Output row. That also raises the room for its answer, which the prompt does not want.

## Solution

The Reasoning Budget percent applies to the **endpoint's Max Output**, not to the prompt's cap. The endpoint is the one the prompt routes to. The prompt's own cap, its Max Output row or its shipped cap, now means only the answer's length.

When reasoning is on, the request sends `max_tokens` = answer cap + thinking budget. The thinking gets its own room, and the answer keeps all of its room.

- With an endpoint Max Output of 512 and narration at 150%, narration sends a budget of 768 and `max_tokens` 1280.
- With an endpoint Max Output of 1024 and Memory Selector at 25%, Memory Selector sends a budget of 256 and `max_tokens` 556.

The slider goes up to 150%. A player can let the model think a little longer than a normal reply without a second setting.

When the endpoint's Max Output override is off, no budget applies. The request sends no budget field and adds no headroom, so the model thinks as long as it wants. The slider is disabled and shows a hint to set a Max Output on the endpoint.

## Rulings

- **Q1 Uniform headroom.** Every reasoning-on prompt sends answer cap + budget, narration included.
- **Q2 Routed base.** The base is the Max Output of the endpoint the prompt routes to. The built-in engine uses its own max tokens.
- **Q3 Row is answer-only.** A prompt's Max Output row sets the answer cap only. It no longer moves the budget.
- **Q4 Level-only headroom.** An endpoint that takes only an effort level gets the same headroom. No budget field is sent. The headroom gives the model room, but it does not limit the thinking.
- **Q5 Defaults kept.** 40% narration, 25% for all other prompts.
- **Q6 Stat pass unblocked only.** Stat Updates stay reasoning-off by default. The spill memo records that the budget model no longer blocks the fix.
- **Q7 / Q9 Override off.** No budget field, no headroom, unlimited thinking. The answer cap still applies. Exceptions: Q13 and Q14.
- **Q8 Side calls out.** Bridge descriptions, image prompts and summarize keep their own caps.
- **Q10 Readout when off.** The slider is disabled, shows the percent, and shows a hint to set a Max Output on the endpoint.
- **Q11 Slider max 150%.** The step stays at 5. The slider gets no new mark at 100%.
- **Q12 Reserve covers thinking.** The narration context reserve covers answer cap + budget when reasoning is on.
- **Q13 Off signal always goes out.** A prompt with effort `none` sends the dialect's 0 budget even when the override is off. Only an ON prompt with no base sends no budget field.
- **Q14 Floor headroom with no base.** A dialect with a budget floor, such as Anthropic's 1024, sends the floor when the override is off, and `max_tokens` = answer cap + floor. The rule keys off the dialect's floor, not a model name.
- **Q15 Guidance reads the answer cap.** The narration length guidance and the reserve both read the answer cap through the same resolution the request uses. Narration has no Max Output row, so today that is the endpoint's Max Output. No row is added; that is out of scope.
- **Q16 Headroom rides a signal or a known reasoner.** Headroom is added when the request carries a reasoning signal (a budget field, an effort level, or a dialect's own on field), or when the record answers `reasons: true`. A model that thinks by default with only an off switch, such as Kimi K2, gets pct × base headroom with no field sent. An unprobed or plain endpoint (`reasons` unanswered) that is sent no reasoning field keeps today's body. This matches the Settings panel, which draws no reasoning control for such a record.
- **Q17 Level-as-budget dialects with no base.** A dialect that spells strength only as a budget (Google 2.5) sends no budget field and no headroom when the override is off, per Q7. The model then thinks dynamically. With a base present, the mapped level budget goes out only where the record's budget answer is not yes, and the headroom is pct × base, not the mapped value.

## User Stories

1. As a player, I want a reasoning-on Memory Selector to get a real thinking budget, so that its choice of memories is thoughtful.
2. As a player, I want the answer of a short prompt to keep its full room when reasoning is on, so that the thinking never cuts off the answer.
3. As a player, I want one setting to control how long every prompt may think, so that I do not tune a cap per prompt.
4. As a player, I want the budget percent to mean a share of my endpoint's Max Output, so that the number makes sense next to the setting I already know.
5. As a player, I want a prompt's Max Output row to control only the answer length, so that a longer thought does not also mean a longer reply.
6. As a player, I want narration to keep its full Max Output for prose when reasoning is on, so that thinking does not make my narration shorter.
7. As a player who routes a prompt to a second endpoint, I want its budget to follow that endpoint's Max Output, so that a large model and a small model each get the right budget.
8. As a player on the built-in engine, I want the budget to follow the engine's max tokens, so that local play works the same way.
9. As a player on an endpoint that takes only an effort level, I want the request to have room for the thinking, so that a short prompt still gets its answer.
10. As a player, I want to set the budget above 100%, so that the model can think longer than one normal reply without a second setting.
11. As a player, I want the slider to stop at 150%, so that I cannot set a budget that fills the context by accident.
12. As a player with the endpoint override off, I want reasoning to run without a budget, so that the model thinks as it would with no limit.
13. As a player with the endpoint override off, I want the slider disabled with a hint, so that I know why the budget has no effect and how to turn it on.
14. As a player, I want the readout to show the token result from the endpoint's Max Output, so that I see what the percent gives.
15. As a player, I want the readout for Stat Updates and Location Change to match what the request sends, so that the readout never lies.
16. As a player, I want the context window to reserve room for the answer plus the thinking, so that a long thought never overflows the context.
17. As a player with reasoning off for a prompt, I want the request to be the same as today, so that turning reasoning off costs nothing.
18. As a player, I want the default percents to stay the same, so that my play does not change without a reason.
19. As a player on an Anthropic endpoint, I want its minimum budget honored and covered by the cap, so that the API does not reject the request.
20. As a preset author, I want a shared preset to carry a budget above 100%, so that the preset works the same for the people who import it.
21. As a player on an older build, I want an imported preset with a budget above 100% to load, so that the import does not fail.
22. As a developer, I want one function to compute the budget, the request cap and the reserve, so that the request, the readout and the context never disagree.
23. As a developer, I want the stat-pass spill memo to record that the budget model no longer blocks the fix, so that the next attempt starts from the right place.

## Implementation Decisions

- **One budget function.** A pure function takes the resolved effort, the prompt kind, the stored budget percents, the endpoint's Max Output (or none), and the prompt's answer cap. It returns the thinking budget and the total output cap. The request spec, the narration context reserve and the Settings readout all call it.
- **Base.** The base is the routed target's Max Output when its override is on. For the built-in engine, the base is the engine's max tokens. When the override is off, no base exists and the budget is absent. An absent budget is different from 0, because 0 is the off signal.
- **Budget.** `round(pct% × base)`. The percent resolves from the stored value or the shipped default, clamped to 5–150. When the effort is `none`, the budget is 0 and no headroom is added, with or without a base. This keeps today's off signal on every dialect that spells off as a 0 budget.
- **Total cap.** When a budget is present and reasoning is on for a model that is not ruled out, the total cap is answer cap + budget. With no answer cap (narration with the override off), no `max_tokens` is sent, as today.
- **Dialects.** A dialect that takes a budget field spells the budget. A level-only dialect sends its level, and the total cap still includes the headroom. A dialect with a floor applies it first, and the headroom uses that final budget, so the budget always stays under the cap. With the override off, a dialect with a floor sends the floor and adds it as headroom, so a short prompt on Claude 3.7 to 4.6 still thinks.
- **Answer cap.** The prompt's custom Max Output row, else the call's shipped or computed cap, else the endpoint's Max Output. This order is today's order. Only its role changes.
- **Reserve.** The narration context reserve takes the total cap when reasoning is on for narration.
- **Length guidance.** The narration length guidance reads the answer cap, the same number the reserve starts from. It describes the answer.
- **Slider.** The maximum goes from 100 to 150 in the slider, in the resolve clamp, and in the shared-preset import clamp. The step stays at 5.
- **Readout.** It shows `pct% · N tok` from the endpoint base for every prompt. The readout for Stat Updates and Location Change no longer falls back to a different cap. With the override off, the slider is disabled and a hint names the fix. The hint follows the Writing Guide.
- **Copy.** The Reasoning Budget description and ⓘ say the percent is a share of the endpoint's Max Output, and that the thinking comes in addition to the answer.
- **Export shape.** No field changes. Shared presets can now carry `reasoningBudget` values up to 150. A released build clamps them to 100 on import.

## Testing Decisions

- Test external behavior only: what the request body carries, what the readout shows, what the reserve returns. Do not test the budget function alone.
- **Request body** (main seam): budget from the endpoint base, not the prompt cap; `max_tokens` = cap + budget; routed endpoint as base; override off gives no budget field and no headroom; override off with effort `none` still sends 0; override off on a floor dialect sends the floor and cap + floor; effort `none` gives budget 0 and no headroom; level-only headroom; Anthropic floor inside the cap; 150% accepted; 151% clamped. Prior art: the budget and dialect blocks in the request spec tests. Tests that pin budget-inside-cap get rewritten to the new rule, not deleted.
- **Settings readout**: tokens from the endpoint base with a custom Max Output row set; the disabled slider and hint with the override off; slider max 150. Prior art: the prompt options tests of the Settings modal.
- **Reserve**: one test that the narration reserve includes the budget when reasoning is on and does not when it is off. One test that a custom narration Max Output row moves both the reserve and the length guidance.
- **Shared preset import**: a value of 150 survives the import; 200 clamps to 150.
- Each guard must bite: put back the prompt-cap base and watch the request tests fail.

## Out of Scope

- Bridge descriptions, image prompts and summarize. They write their own `max_tokens` outside the request spec.
- Default-on reasoning for Stat Updates. That needs its own probe.
- New default percents.
- A visual mark at 100% on the slider.
- A hard limit on thinking for level-only endpoints. The API does not take one.

## Further Notes

- The stat-pass spill memo and the model research notes name this budget model as the blocker. Both get a line that points here.
- The endpoint-generation-overrides spec says override off also removes the output reserve. This spec keeps that behavior.
