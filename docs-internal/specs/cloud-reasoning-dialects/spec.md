# Cloud Reasoning Dialects

Status: ready-for-agent
Spec session: Cloud Reasoning Dialects

## Problem Statement

A player on a cloud endpoint gets less from the Native Reasoning controls than a player on LM Studio or the built-in engine. The Reasoning Budget slider never shows, because the app only knows one budget field and only two backends take it. The switch and the strength are sent in one spelling, `reasoning_effort` with `none` for off, and several cloud APIs spell them differently or reject that spelling outright.

Live checks on 2026-09-15 and 2026-09-16 show the spread. OpenRouter takes a budget as `reasoning.max_tokens` and says per model whether it does. Anthropic's OpenAI-compatible endpoint takes a budget as a `thinking` object and documents `reasoning_effort` as ignored. Google's takes a budget or a level inside a `google.thinking_config` object and maps `reasoning_effort` onto it. A current vLLM takes `thinking_token_budget`. Kimi's k3 takes `reasoning_effort` with only `low`, `high`, and `max`; its k2.6 switches thinking with `thinking.type`; its k2-thinking and k2.7-code reject off entirely. OpenAI takes an effort level and nothing else. The hosted Default, an Aphrodite server, answers 200 to any field and never separates its reasoning, so nothing applies there until its server changes.

The result for the player: a budget slider that hides where a budget exists, an off switch that silently does nothing on some models and fails the request on others, and a strength dropdown listing levels the model does not take.

## Solution

The app learns each cloud endpoint's reasoning dialect and speaks it. The capability record gains three answers beside the ones it has: which key carries the token budget, which key carries the off switch, and whether off is allowed at all. The resolver fills them from the endpoint's identity and its own advertisement, never from a blind probe, since a 200 proves nothing on the hosted Default.

Every request then goes out in the target's spelling. The same percent from the slider becomes `thinking_budget_tokens` on LM Studio, `thinking_token_budget` on vLLM, `reasoning.max_tokens` on OpenRouter, a `thinking` object with `budget_tokens` on Anthropic, and a `google.thinking_config` on Google. The same off switch becomes `reasoning_effort: none` where that is honored, `thinking.type: disabled` on Kimi k2.6, `thinking.type: disabled` on Anthropic, and nothing at all on a model that rejects off. The controls follow: the slider shows wherever the record names a budget key, the off switch hides where off is rejected, and the dropdown lists only the levels the record names.

## User Stories

1. As a player on OpenRouter, I want the Reasoning Budget slider on a model that takes a token budget, so that I cap thinking the same way I do on LM Studio.
2. As a player on OpenRouter, I want the strength dropdown to list the efforts the model supports, so that a pick never fails a turn.
3. As a player on OpenRouter using a model with mandatory reasoning, I want the off switch hidden, so that I cannot send a request the model rejects.
4. As a player on Anthropic's OpenAI-compatible endpoint, I want the budget slider, so that my cap reaches the model as a thinking budget.
5. As a player on Anthropic's endpoint, I want the strength dropdown hidden, so that I am not offered a level the endpoint documents as ignored.
6. As a player on Anthropic's endpoint, I want the budget kept below the output cap, so that the request is not rejected for a budget that exceeds it.
7. As a player on Google's OpenAI-compatible endpoint with a 2.5 model, I want the budget slider, so that my cap reaches the model as a thinking budget.
8. As a player on Google's endpoint with a 3.x model, I want the strength dropdown mapped to thinking levels, so that Low and High mean what the model understands.
9. As a player on a vLLM server with a reasoning parser, I want the budget slider, so that my cap reaches the server as a thinking token budget.
10. As a player on a vLLM server without a reasoning parser, I want no budget slider and no effort control, so that I am not shown controls that do nothing.
11. As a player on Kimi k3, I want the dropdown to list Low, High, and Max only, so that a pick never fails a turn.
12. As a player on Kimi k2.6, I want the off switch to reach the model, so that switching a prompt off actually stops its thinking.
13. As a player on Kimi k2-thinking or k2.7-code, I want the off switch hidden, so that I cannot send a request the model rejects.
14. As a player on OpenAI, I want the effort dropdown and no budget slider, so that the controls match what the API takes.
15. As a player on the hosted Default, I want no Native Reasoning controls, so that a server that does not separate its reasoning does not pretend to.
16. As a player on any endpoint, I want the dialect chosen from the endpoint and its advertisement, never from a test request, so that a server that answers 200 to anything is not misread.
17. As a player, I want the dialect cached with the rest of the record per endpoint and model, so that switching setups does not re-detect.
18. As a player, I want a change of endpoint or model to re-detect the dialect, so that a stale spelling from another target is never sent.
19. As a player, I want the AI Context viewer's endpoint line to show the budget and effort in the spelling that went out, so that I can see what the endpoint received.
20. As a player, I want the built-in engine and LM Studio to keep working exactly as they do now, so that this change costs me nothing there.
21. As a player, I want a shared preset to carry my percent and levels unchanged, so that the dialect is never part of what I export.
22. As a developer, I want the dialect to be a named value on the capability record, so that the request builder is a table lookup with no endpoint logic of its own.
23. As a developer, I want each dialect's spelling tested from a plain snapshot, so that adding a dialect is one row and one test.
24. As a developer, I want identity detection tested with a mocked fetch and fixed hostnames, so that no test needs a live cloud account.
25. As a developer, I want the record to say where the dialect answer came from, so that a wrong spelling can be traced.
26. As a developer, I want an unknown dialect to send only what today's behavior sends, so that a new endpoint is never worse off than before.

## Implementation Decisions

**Dialect on the record.** The capability record gains a dialect answer with a source, beside reasons, levels, and budget. A dialect names three things: the budget key shape, the off-switch shape, and whether off is allowed. The known dialects are: openai (effort only, off as `none`), lmstudio (budget `thinking_budget_tokens`, off as `none`), vllm (budget `thinking_token_budget`, off as `none`), openrouter (budget `reasoning.max_tokens`, effort `reasoning.effort`, off as `reasoning.effort: none` unless mandatory), anthropic-budget and anthropic-adaptive (see the generation split below), google-2.5 (budget `google.thinking_config.thinking_budget`, effort mapped to the documented budget per level, off as `reasoning_effort: none`), google-3 (level `google.thinking_config.thinking_level`, effort mapped to those levels, no budget, no off), moonshot-k3 (effort `low | high | max`, no off), moonshot-k2 (off as `thinking.type: disabled`, no effort). Unknown is the default and sends what the app sends today. The whole table, with each row's spelling, clamp, and level mapping, lands with the request builder; the later tickets add detection only. (Ruled 2026-09-16 for ticket 01.)

**One identity source.** Host-identity detection is one source in the resolver, first in the native chain, holding a table of rows: a host matcher and a function from model id to the partial record it names (dialect, levels, off-allowed). Anthropic, Google, Moonshot, and OpenAI are one row each; tickets 03 and 04 add rows to the same table, and whichever lands first also adds the `identity` source member. A dialect that refuses off never lists `none` among its levels, so the guarded level write can never spell off there; k3 lists low, high, max and google-3 lists its documented levels. (Ruled for ticket 04, 2026-09-16.)

**Detection by identity and advertisement, never by probe.** The resolver names the dialect from, in order: the endpoint host for the first-party APIs (Anthropic, Google, Moonshot, OpenAI); the OpenRouter models list, which also fills levels, budget support from `supports_max_tokens`, and the mandatory flag; LM Studio's native list and vLLM's models-list shape, as the existing chain already reads them. vLLM is marked budget-capable only after one observed reply carried a separate reasoning field, since the parser is a server-side option nothing advertises. The hosted Default's Aphrodite shape is treated as vLLM without a parser until a reply proves otherwise, and so gets no controls. A single probe request is never used to choose a dialect.

**Off spelling stands alone.** A dialect that names its own off spelling sends that field alone, never a zero budget beside it, because those endpoints reject the pair: OpenRouter off is `reasoning.effort: none` with no `max_tokens`, google-2.5 off is `reasoning_effort: none` with no thinking config. On google-2.5 the level and the budget share one field, so the player's budget wins it and the level-to-budget mapping applies only when the record says no budget. (Built in ticket 01, confirmed 2026-09-16.)

**Off-allowed is a record answer, not only a dialect property.** The dialect row carries a default for whether off is allowed. The record carries its own off-allowed answer with a source, which overrides the row's default when present. Ticket 02 sets it from OpenRouter's `mandatory` flag; ticket 04 sets it from the Kimi model id. Ticket 01 shipped the row default only, so a mandatory OpenRouter model does not lock its switch until 02 lands.

**Anthropic splits by generation.** (Verified live 2026-09-16 on the extended-thinking page.) `thinking: { type: "enabled", budget_tokens }` is deprecated on Claude 4.6 and rejected with a 400 on Claude 4.7 and later, Claude 5 included; those take `thinking: { type: "adaptive" }` and control depth with `output_config.effort`. So anthropic is two rows picked by model id: anthropic-budget for 4.6 and earlier (budget as `thinking.budget_tokens`, off as `thinking.type: disabled`, no effort) and anthropic-adaptive for 4.7 and later (on as `thinking.type: adaptive`, off as `thinking.type: disabled`, no budget, no effort, since the OpenAI-compat page documents only `thinking` in `extra_body` and `output_config` passthrough is unverified). On anthropic-adaptive the switch is the only control. An unmatched Claude id is adaptive. `budget_tokens` has a documented minimum of 1,024, so the anthropic-budget row carries a minimum: the builder sends the larger of the minimum and the slider's tokens, then clamps under the cap, and sends no thinking object at all when the cap leaves no room. Ticket 03 owns both.

**Three off shapes.** (Ruled in ticket 01's review, 2026-09-16.) A dialect that carries the `none` literal spells off through the ordinary guarded level write, so it goes out only where the record lists `none`; vllm and openrouter are this shape, with no budget beside off. Only a dialect named from endpoint identity spells off in a field of its own, since identity is the one source that cannot be a bare models-list shape. A dialect that refuses off sends nothing. This keeps a vLLM marked from `max_model_len` alone, the hosted Default included, sending exactly what it sends today.

**A switched-off prompt on a refuse-off model.** Its resolved choice must be its stored level, not `none`, once off is rejected; otherwise no effort literal goes out and the model spends its own default while the locked switch reads as on. "Off is rejected" reads the record's off-allowed answer first and the dialect row's default when the record has none, so one rule covers OpenRouter's mandatory models, google-3, and moonshot-k3 alike. Ticket 02 closes this with the record answer it adds.

**The Output row keeps its dropdown.** When the active model reasons but exposes no strength, only the prompt row hides its dropdown. The Output row is the endpoint-wide strength every Global prompt follows, including prompts routed to other endpoints whose records do list levels, so it stays. It hides only behind the note when the active model is ruled out entirely, as ticket 01 built. (Ruled for ticket 02, 2026-09-16.)

**Reasons true with no levels.** A record may say the model reasons and list no effort levels at all: OpenRouter omits `supported_efforts` on a model that exposes no effort selection while still taking a budget. That record shows the switch and, where the record allows, the slider, and no dropdown. An empty level list rules reasoning out only when the reasons answer is not true. `null` levels stay the unknown form; an empty list is never used to mean unknown. (Ruled for ticket 02, 2026-09-16.)

**google-2.5 ladder.** The documented mapping stops at high: minimal and low 1024, medium 8192, high 24576. The record's levels for google-2.5 must list only those literals, so a player never lands on xhigh or max with no thinking config sent. Ticket 03 sets them.

**Mandatory off.** Where the record says off is rejected, the resolved choice `none` sends no reasoning field at all rather than the off spelling, and the prompt and Output switches render checked and disabled with the existing short note explaining that this model always reasons.

**Levels from the dialect.** Google 3.x and Kimi k3 have ladders with gaps. The record's levels answer holds exactly the accepted literals, the dropdown lists those, and the current pick stays listed as it does today. Google 2.5 maps Formamorph's level to the documented thinking budget for that level.

**Budget under the cap.** On dialects where the budget must sit below the output cap, the request builder clamps the sent budget to one token under the cap. The slider itself is unchanged.

**Percent stays the unit.** The slider's percent of max output converts to tokens exactly as it does for LM Studio, then goes out in the dialect's key. No new setting, no export-shape change.

**AI Context line.** The endpoint line shows the fields as sent, so a player on OpenRouter reads `reasoning.max_tokens` and a player on LM Studio reads `thinking_budget_tokens`.

**vLLM proof licenses both controls.** On the vllm dialect the slider and the dropdown both wait for proof that the server separates its reasoning. Proof is one reply with a non-empty separate reasoning field; an inline think block in the content marks reasons yes as before but never proves separation. On proof the observation marks budget yes and fills levels with the safe set, source observed, so a picked level goes out on the same parsed path. Before proof the record's levels stay null, so the guarded level write sends nothing, which is what the hosted Default needs. The gate is specific to the vllm dialect and to the prompt row; the Output row keeps its dropdown while proof is awaited, since an unproven record is not ruled out and routed Global prompts still follow that row. Separation, once seen, is sticky per endpoint and keys the re-resolve, so a server that answers inline first still earns its controls on the first separated reply. An unknown-dialect record keeps today's dropdown and safe fallback. (Ruled for ticket 05, 2026-09-16.)

**Hosted Default.** Out of the app's hands. The spec records that the server needs a reasoning parser before any of this applies to it, and that the app must show no reasoning controls there until a reply proves separated reasoning.

## Testing Decisions

A good test feeds plain inputs to a seam and asserts what the endpoint would receive or what the player would see.

**Request building** is tested through the existing request-spec tests: one case per dialect for the budget spelling, one per dialect for the off spelling, the mandatory case sending no field, the Anthropic clamp under the cap, the Google 2.5 level-to-budget mapping, and the unknown dialect matching today's body byte for byte.

**Capability resolution** is tested through the resolver with a mocked fetch and fixed hostnames: each first-party host names its dialect; the OpenRouter models entry fills dialect, levels, budget, and mandatory; a vLLM models shape names the dialect without budget, and an observed reasoning reply adds it; the Aphrodite shape yields no controls; no path sends more than the existing single probe, and dialect never depends on it.

**Settings UI** extends the existing prompt-Options reasoning tests: slider shown per budget-capable dialect, switch disabled on mandatory, dropdown listing a gapped ladder.

**Live verification** once per dialect the user has a key for, recorded in the changelog entry with the token count observed. Dialects without a key are marked as tested against docs only.

## Out of Scope

- Changing the hosted Default's server. That is a request to its operator.
- A client-side budget for servers with no cap, such as llama.cpp's control endpoint.
- Google's older `thinking_budget` on 3.x models, which have moved to levels.
- Preserved thinking, thinking in tool calls, or multi-turn reasoning retention on any provider.
- A per-endpoint dialect override in the endpoint preset. Detection only, per the seam decision.
- Any change to the switch-plus-strength control, the per-prompt tiers, or the Inline narration rule.

## Further Notes

Sources are the live docs and endpoints as read on 2026-09-15 and 2026-09-16: OpenRouter's reasoning-tokens guide and models list; Anthropic's OpenAI SDK compatibility page; Google's OpenAI compatibility page; vLLM's reasoning outputs guide and chat completion request schema, where `thinking_token_budget` landed in mid-2026; Moonshot's chat API reference dated 2026-08-31; and eight live requests against the hosted Default. The reasoning-capability-and-budget spec holds the record, the chain, and the source precedence this spec extends.
