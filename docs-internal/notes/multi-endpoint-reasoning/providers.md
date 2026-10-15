# Reasoning across endpoints: how providers and gateways do it

Research date: 2026-10-14. Primary sources only: official docs (fetched as their `.md` versions where offered), API references, and source code pinned to a commit.

Pinned commits:

- llama.cpp `master` @ `a0e6dc7` (full: `a0e6dc7384edb8f5d927155e1d26c10b4a310e6d`)
- LiteLLM `main` @ `f50f141` (full: `f50f14117fd879f16caa761cbe34081618508786`)
- vLLM `main` @ `273a049` (full: `273a04964ed9d1e389c4a7cb9d660e8294782f8d`)
- Vercel AI SDK `main` @ `b658e85` (full: `b658e8503c789126ca5f9d0bb007a43be8a46a41`)
- openai-python `main` @ `21ce0c2` (full: `21ce0c2eae47b389f25d79095d2ac5aec7812806`)

## Summary

| Target | Knobs on the wire | Output cap includes reasoning? | Effort → budget mapping | When the thought eats the cap |
|---|---|---|---|---|
| OpenAI | `reasoning_effort` (Chat), `reasoning.effort` (Responses); `none`…`max`, model-dependent | Yes. `max_completion_tokens` and `max_output_tokens` both include reasoning | None. Effort is the native knob; no public budget | Responses: `status: "incomplete"`, `incomplete_details.reason: "max_output_tokens"`, can have no visible output. Chat: `finish_reason: "length"` |
| Anthropic | Legacy `thinking: {type:"enabled", budget_tokens}`; current `thinking: {type:"adaptive"}` + `output_config.effort`; `disabled`, `between_tools` | Yes. `max_tokens` is a hard cap on thinking plus text | None server side. Budget is a soft target; effort is soft guidance | `stop_reason: "max_tokens"` |
| Google Gemini | `thinkingBudget` (2.5; `0` off, `-1` dynamic), `thinkingLevel` (3/4); OpenAI-compat `reasoning_effort` | Yes. `max_output_tokens` includes thought tokens | Compat layer: minimal/low → 1,024, medium → 8,192, high → 24,576 (2.5) | `finish_reason: MAX_TOKENS`, truncated or empty output |
| OpenRouter | `reasoning: {effort | max_tokens, exclude, enabled}` | Yes, on most providers | `budget = max(min(max_tokens × ratio, 128000), 1024)`; ratio 0.95/0.95/0.8/0.5/0.2/0.1 | `finish_reason: "length"`, empty `content` |
| LiteLLM | `reasoning_effort` → per-provider `thinking` / `thinkingConfig` / `output_config` | Follows the provider. Caps Anthropic budget to `max_tokens − 1` | Fixed: minimal 128 (Anthropic floor 1024), low 1024, medium 2048, high 4096, xhigh 8192, max 16384 | Maps provider reasons to `"length"`; no retry found |
| Vercel AI SDK | Top-level `reasoning` (`provider-default`, `none`…`max`) plus `providerOptions` | Anthropic: SDK adds budget on top of `maxOutputTokens` | Percent of model max output: 2/10/30/60/90/95 %, clamped to [1024, cap] (Gemini 2.5: floor 0) | Passes the provider's finish reason through. UNVERIFIED — haven't checked a retry path |
| vLLM | `reasoning_effort` (toggles `enable_thinking` only), `chat_template_kwargs`, `thinking_token_budget`, `include_reasoning` | Yes. `max_tokens` is the outer generation limit | None. Effort is not turned into a budget | Budget hit: sampler forces `reasoning_end_str` and the answer continues. `max_tokens` hit: normal length stop |
| llama.cpp server | `reasoning_effort` (`none` = off, else passed to template), `chat_template_kwargs`, `reasoning_budget_tokens`, `reasoning_control` + `POST /v1/chat/completions/control` `reasoning_end` | Yes. `n_predict` / `max_tokens` counts every generated token | None. Effort only reaches the Jinja template | Budget hit: sampler forces the end tag (optional message first). Cap hit: `finish_reason: "length"` |
| Novita | `enable_thinking` (hybrid models only), `separate_reasoning` | Yes. Docs say it "can include reasoning tokens" | None documented | Empty `content`, `finish_reason: "length"` |

## Common patterns

**Sizing the thinking room.** Every hosted API counts reasoning inside the output cap. Three conventions exist for where the budget lives relative to that cap:

1. **Budget as a share of the cap.** OpenRouter takes a ratio of `max_tokens` (0.95 at max, 0.1 at minimal). The rest is answer room.
2. **Budget added on top of the cap.** The Vercel AI SDK treats `maxOutputTokens` as answer room and sends `max_tokens = maxOutputTokens + budget` to Anthropic.
3. **Fixed budget, clamped under the cap.** LiteLLM uses fixed numbers and trims the budget to `max_tokens − 1` when it does not fit.

The 1,024-token floor appears everywhere Anthropic is involved: Anthropic itself, OpenRouter, LiteLLM, and the AI SDK default.

**A thought that never ends.**
- Hosted APIs truncate. They return `length`, `max_tokens`, `MAX_TOKENS`, or `incomplete`, often with empty `content`, and still bill the reasoning.
- Local servers can force an exit. llama.cpp and vLLM run a sampler that counts tokens inside the reasoning block. At the budget, it forces the end-of-thinking tag, optionally with a transition phrase first, and the model then writes the answer.
- llama.cpp also lets a client end thinking live, through `/v1/chat/completions/control`.
- No gateway I checked retries automatically on a cut thought. OpenRouter documents detection: `completion_tokens − reasoning_tokens ≈ 0`.

## OpenAI

**Knobs.** `reasoning.effort` (Responses) and `reasoning_effort` (Chat Completions). Values are "model-dependent and can include `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`". Some models reject `none` with HTTP 400. [reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) (lines 190–195 of the `.md` version). I found no public token-budget knob.

**Cap.** `max_output_tokens` limits "reasoning tokens, visible output tokens, and non-visible formatting tokens" ([reasoning guide](https://developers.openai.com/api/docs/guides/reasoning), "Controlling costs"). Chat's `max_completion_tokens` is "an upper bound … including visible output tokens and reasoning tokens". `max_tokens` is deprecated and "not compatible with o-series models". Source: [completion_create_params.py:117-132](https://github.com/openai/openai-python/blob/21ce0c2eae47b389f25d79095d2ac5aec7812806/src/openai/types/chat/completion_create_params.py#L117-L132).

**Floor/room.** OpenAI recommends "reserving at least 25,000 tokens for reasoning and outputs" when you start ([reasoning guide](https://developers.openai.com/api/docs/guides/reasoning), "Allocating space for reasoning").

**Cut thought.** On Responses: `status` `incomplete` with `incomplete_details.reason` `max_output_tokens`. The guide says this "might occur before any visible output tokens are produced", and the input and reasoning tokens are still billed. On Chat, `finish_reason` is `length` when the cap is reached ([chat_completion.py:40-46](https://github.com/openai/openai-python/blob/21ce0c2eae47b389f25d79095d2ac5aec7812806/src/openai/types/chat/chat_completion.py#L40-L46)). No automatic retry is documented.

**Detection.** The `Model` object has only `id`, `created`, `object`, `owned_by`, and `shutdown_date` ([model.py](https://github.com/openai/openai-python/blob/21ce0c2eae47b389f25d79095d2ac5aec7812806/src/openai/types/model.py)). So `/v1/models` has no reasoning flag. Reasoning shows up only in `usage.output_tokens_details.reasoning_tokens` after a call.

## Anthropic

**Knobs.**
- Legacy manual mode: `thinking: {type: "enabled", budget_tokens: N}`. It is deprecated on 4.6 models and rejected with 400 on 4.7 and later ([extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking), line 12).
- Current mode: `thinking: {type: "adaptive"}`, with depth set by `output_config.effort`. Effort values are `low`, `medium`, `high`, `xhigh`, and `max` ([thinking steering and cost](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost), "Effort levels").
- Other types are `disabled` and `between_tools`. `display` can be `summarized` or `omitted`; `omitted` is the default on many current models ([thinking](https://platform.claude.com/docs/en/build-with-claude/thinking), lines 43–75 and 482–488).

**Always on.** Several current models reject `disabled` with 400, and "thinking can't be turned off" on them. Some accept `disabled` only at effort `high` or below. Sonnet 5.5 uses `between_tools` as its lowest setting ([thinking](https://platform.claude.com/docs/en/build-with-claude/thinking), lines 468–474).

**Cap.** Thinking tokens "count toward `max_tokens` alongside the response text" ([thinking](https://platform.claude.com/docs/en/build-with-claude/thinking), line 15). `max_tokens` "is enforced as a strict limit" (line 1136). In adaptive mode, "You don't set a thinking token budget": `max_tokens` is the hard cap and `effort` is soft guidance ([steering](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost), "Cost control").

**Budget limits (manual mode).** The minimum is 1,024; "The API rejects smaller values". The budget must be less than `max_tokens`, except with interleaved thinking. The budget is "a target rather than a strict cap" ([extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking), lines 272–278).

**Effort → budget.** Not applicable server side. Effort is the native knob on adaptive models.

**Cut thought.** `stop_reason: "max_tokens"`; Anthropic suggests raising `max_tokens` or continuing ([handling stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)). If generation hits the context window first, the stop reason is `model_context_window_exceeded` on 4.5+ models ([thinking](https://platform.claude.com/docs/en/build-with-claude/thinking), line 1136).

**Detection.** The Models API returns `capabilities`, including `thinking.types.disabled.supported`. That flag is `false` when the model rejects `disabled` ([models overview](https://platform.claude.com/docs/en/models/overview), lines 70–74).

## Google Gemini

**Knobs.**
- `thinkingBudget`, introduced with 2.5: `0` turns thinking off and `-1` is dynamic thinking.
- `thinkingLevel`: required for Gemini 4 and recommended for Gemini 3.
- On Gemini 4, `thinkingBudget` alone maps to the nearest level with a warning. Sending both returns 400 ([generate-content thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking), lines 370, 508–517).

**Budget ranges** (same page, lines 520–528):

| Model | Range | Can disable? |
|---|---|---|
| 2.5 Pro | 128 to 32768 | No |
| 2.5 Flash | 0 to 24576 | Yes |
| 2.5 Flash Lite | 512 to 24576 | Yes; off by default |

Gemini 4 Argon cannot disable thinking. Gemini 3 Flash and Flash-Lite "do not support full thinking-off" (line 477). The model "might overflow or underflow the token budget" (line 635).

**Cap.** `max_output_tokens` includes thought tokens. It is "a hard cutoff enforced by the infrastructure without changing how the model allocates its thinking budget" (lines 485–499).

**Cut thought.** `finish_reason: MAX_TOKENS` with "truncated or empty output", and the thinking is still billed. The Interactions API instead returns status `"incomplete"` ([thinking](https://ai.google.dev/gemini-api/docs/thinking), lines 698–712).

**OpenAI-compat mapping** ([openai compatibility](https://ai.google.dev/gemini-api/docs/openai), lines 93–105):

| `reasoning_effort` | Gemini 2.5 `thinking_budget` |
|---|---|
| `minimal` | 1,024 |
| `low` | 1,024 |
| `medium` | 8,192 |
| `high` | 24,576 |

- On 3.x and 4, effort maps to `thinking_level`.
- `none` disables thinking only on 2.5 models. "Reasoning cannot be turned off for Gemini 2.5 Pro or 3 models."
- `reasoning_effort` and `thinking_level`/`thinking_budget` cannot be sent together (line 177).

**Detection.** The `Model` resource has `thinking: boolean`, "Whether the model supports thinking" ([models API](https://ai.google.dev/api/models), line 209).

## OpenRouter

**Knobs.** `reasoning.effort` (`max`, `xhigh`, `high`, `medium`, `low`, `minimal`, `none`), `reasoning.max_tokens`, `reasoning.exclude`, and `reasoning.enabled`. Effort and `max_tokens` are mutually exclusive. `enabled: true` means medium effort ([reasoning tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), lines 79–82 and 175–183 of the `.md`).

**Effort → budget.** Quoted directly from the `.md`, lines 1040–1047:

> "The reasoning token allocation is capped at 128,000 tokens maximum and 1024 tokens minimum. The formula for calculating the budget_tokens is: `budget_tokens = max(min(max_tokens * {effort_ratio}, 128000), 1024)`"
>
> "effort_ratio is 0.95 for max and xhigh effort, 0.8 for high effort, 0.5 for medium effort, 0.2 for low effort, and 0.1 for minimal effort."

- A direct `reasoning.max_tokens` is "used directly with a minimum of 1024 tokens".
- For effort-only models, "the `max_tokens` value will be used to determine the effort level" (line 151).
- An unsupported effort maps "to the nearest supported level" (line 1163).
- On Gemini 3, a budget passes through as `thinkingBudget`, but Google maps it to a level, "so you will not get precise token control" (line 1167).

**Cap.** On most providers, `max_tokens` (or `max_completion_tokens`) "applies to reasoning and visible output combined". For Anthropic, `max_tokens` must be strictly higher than the budget (lines 94–99).

**Cut thought.** `finish_reason: "length"` with empty `content`, and the reasoning is still billed. With `exclude: true`, "the only signal left is `finish_reason` plus `usage`". The fix is a larger `max_tokens` or a smaller reasoning setting (lines 94–99). No automatic retry is documented.

**Detection.** `GET /api/v1/models` returns a `reasoning` object per model, with these fields:
- `supported_efforts`
- `default_effort`
- `default_enabled`
- `supports_max_tokens`
- `mandatory`: when `true`, do not send `effort: "none"`.

Non-reasoning models omit the object (lines 103–125).

## LiteLLM

**Constants** ([constants.py](https://github.com/BerriAI/litellm/blob/f50f14117fd879f16caa761cbe34081618508786/litellm/constants.py)). Each is overridable by an env var of the same name.

| Constant | Value | Line |
|---|---|---|
| `DEFAULT_REASONING_EFFORT_DISABLE_THINKING_BUDGET` | 0 | 193 |
| `DEFAULT_REASONING_EFFORT_MINIMAL_THINKING_BUDGET` | 128 | 303–304 |
| Gemini minimal: 2.5 Flash / 2.5 Pro / 2.5 Flash Lite | 1 / 128 / 512 | 273–281 |
| low / medium / high | 1024 / 2048 / 4096 | 323–327 |
| xhigh / max | 8192 / 16384 | 328–329 |
| `ANTHROPIC_MIN_THINKING_BUDGET_TOKENS` ("rejects … < 1024") | 1024 | 587–588 |
| `BEDROCK_MIN_THINKING_BUDGET_TOKENS` | 1024 | 586 |

**Anthropic mapping** ([anthropic/chat/transformation.py:1377-1435](https://github.com/BerriAI/litellm/blob/f50f14117fd879f16caa761cbe34081618508786/litellm/llms/anthropic/chat/transformation.py#L1377-L1435)).
- `none` removes thinking.
- On adaptive models, any effort becomes `{type:"adaptive", display:"summarized"}` plus `output_config.effort`. `minimal` maps to `low` (lines 277–284 and 1749–1757).
- Otherwise the result is `{type:"enabled", budget_tokens}` from the table above. `minimal` uses `max(128, 1024)`.
- `cap_thinking_budget_to_max_tokens` (lines 1448–1462) drops thinking when `max_tokens ≤ 1024`, and clamps the budget to `max_tokens − 1` when it does not fit.

**Gemini mapping** ([vertex_and_google_ai_studio_gemini.py:890-935](https://github.com/BerriAI/litellm/blob/f50f14117fd879f16caa761cbe34081618508786/litellm/llms/vertex_ai/gemini/vertex_and_google_ai_studio_gemini.py#L890-L935)).
- 2.5: `thinkingBudget` from the same constants, with `includeThoughts: true`. `none` and `disable` become budget 0 with no thoughts.
- 3+: `thinkingLevel` (lines 947–975). `none` maps to `minimal` or `low`, because 3.x cannot turn thinking off.

**Cut thought.** `map_finish_reason` turns `max_tokens`, `MAX_TOKENS`, and `compaction` into `"length"` ([core_helpers.py:202-219](https://github.com/BerriAI/litellm/blob/f50f14117fd879f16caa761cbe34081618508786/litellm/litellm_core_utils/core_helpers.py#L202-L219)). I found no retry on a cut thought. UNVERIFIED — haven't checked LiteLLM's router retry policies for `length`.

**Detection.** `supports_reasoning(model)` reads the `supports_reasoning` key in the model cost map. `supports_none_reasoning_effort` is a separate flag ([utils.py:3095-3112](https://github.com/BerriAI/litellm/blob/f50f14117fd879f16caa761cbe34081618508786/litellm/utils.py#L3095-L3112)).

## Vercel AI SDK

**Knobs.** The top-level `reasoning` value is one of `provider-default`, `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`. Provider-specific `providerOptions` win over it. For an exact budget, "keep using `providerOptions`" ([26-reasoning.mdx](https://github.com/vercel/ai/blob/b658e8503c789126ca5f9d0bb007a43be8a46a41/content/docs/03-ai-sdk-core/26-reasoning.mdx), lines 22–33, 59, 144). Unsupported providers emit an `unsupported` warning (line 89).

**Effort → budget** ([map-reasoning-to-provider.ts:60-108](https://github.com/vercel/ai/blob/b658e8503c789126ca5f9d0bb007a43be8a46a41/packages/provider-utils/src/map-reasoning-to-provider.ts#L60-L108)).
- Percentages: minimal 0.02, low 0.1, medium 0.3, high 0.6, xhigh 0.9, max 0.95.
- Formula: `min(maxReasoningBudget, max(minReasoningBudget = 1024, round(maxOutputTokens × pct)))`.
- `maxOutputTokens` here is the model's maximum, not the request's.

**Anthropic** ([anthropic-language-model.ts](https://github.com/vercel/ai/blob/b658e8503c789126ca5f9d0bb007a43be8a46a41/packages/anthropic/src/anthropic-language-model.ts)).
- Adaptive models get `{type:"adaptive", display:"summarized"}` plus an effort literal (lines 3589–3605).
- Older models get a budget from the helper above, with min 1024 and max equal to the model's max output (lines 3608–3617).
- `none` becomes `between_tools`, `disabled`, or effort `low` on models that reject `disabled` (lines 3565–3586).
- If thinking is on with no budget, it defaults to 1024 with a warning (lines 907–921).
- The SDK then sends `max_tokens = maxOutputTokens + thinkingBudget` (line 952) and clamps to the model limit with a warning (lines 968–979).

**Google** ([google-language-model.ts](https://github.com/vercel/ai/blob/b658e8503c789126ca5f9d0bb007a43be8a46a41/packages/google/src/google-language-model.ts)).
- 3.x: levels. `none` maps to the minimum level, because "It's not possible to fully disable thinking with Gemini 3". xhigh and max both map to `high` (lines 1540–1577).
- 2.5: budget from the percentage helper, with base 65,536, cap 32,768 for Pro and 24,576 otherwise, and `minReasoningBudget: 0`. `none` becomes `thinkingBudget: 0` (lines 1502–1512, 1620–1641).

**OpenAI-compatible.** Sends `reasoning_effort` as the literal ([openai-compatible-chat-language-model.ts:322-324](https://github.com/vercel/ai/blob/b658e8503c789126ca5f9d0bb007a43be8a46a41/packages/openai-compatible/src/chat/openai-compatible-chat-language-model.ts#L322-L324)). It reads `reasoning_content ?? reasoning` from responses (lines 383–384).

**Cut thought.** UNVERIFIED — haven't checked the finish-reason mapping files or any retry behavior.

**Detection.** Capability flags are hard-coded per provider. One example is `supportsAdaptiveThinking` and `rejectsThinkingDisabled` in the Anthropic model, plus `packages/xai/src/supports-reasoning-effort.ts`. I did not trace each one.

## vLLM

**Knobs** ([chat_completion/protocol.py:250-264](https://github.com/vllm-project/vllm/blob/273a04964ed9d1e389c4a7cb9d660e8294782f8d/vllm/entrypoints/openai/chat_completion/protocol.py#L250-L264)).
- `reasoning_effort`: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`.
- `thinking_token_budget`.
- `include_reasoning` (default true).
- `chat_template_kwargs`, for example `enable_thinking` or `thinking`, depending on the model ([reasoning_outputs.md:35-40](https://github.com/vllm-project/vllm/blob/273a04964ed9d1e389c4a7cb9d660e8294782f8d/docs/features/reasoning_outputs.md#L35-L40)).

**Effort.** Effort only injects `enable_thinking = (effort != "none")`, and only when the client did not set it (protocol.py lines 621–622; docs lines 324–339). Effort is never turned into a budget.

**Budget.** "Once the reasoning token count reaches the configured `thinking_token_budget`, vLLM forces the model to produce `reasoning_end_str`". That string can carry a transition phrase such as "I have to give the solution based on the reasoning directly now.</think>". It needs `--reasoning-parser`, and optionally `--reasoning-config` (docs lines 251–274). Validation accepts a non-negative integer or `-1` for unlimited ([sampling_params.py:62-82](https://github.com/vllm-project/vllm/blob/273a04964ed9d1e389c4a7cb9d660e8294782f8d/vllm/sampling_params.py#L62-L82)). There is no minimum.

**Cap.** "If `thinking_token_budget` is not specified, no explicit reasoning limit is applied beyond normal generation constraints such as `max_tokens`" (docs line 263). So `max_tokens` covers reasoning plus answer.

**Detection.** Server side only: a reasoning parser chosen at launch, plus a `reasoning` field in responses (docs lines 1–9). UNVERIFIED — haven't checked whether `/v1/models` exposes it.

## llama.cpp server

Sources: [tools/server/README.md](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/README.md) and server source at `a0e6dc7`.

**CLI flags** (README lines 233–237):
- `--reasoning-format`
- `--reasoning on|off|auto`
- `--reasoning-effort LEVEL`
- `--reasoning-budget N`: "-1 for unrestricted, 0 for immediate end"
- `--reasoning-budget-message`: "message injected before the end-of-thinking tag when reasoning budget is exhausted"

**Per-request fields** (README lines 1349–1355):
- `chat_template_kwargs`
- `reasoning_effort`: "If `none`, reasoning/thinking is disabled. Otherwise, the value is made available to the jinja template."
- `reasoning_format`
- `reasoning_control`

**Effort handling in source.** `none` sets `enable_thinking = false`. Any other value goes into the template kwargs ([server-common.cpp:1420-1428](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/server-common.cpp#L1420-L1428)). No budget comes from effort.

**Per-request budget.** The server reads `reasoning_budget_tokens` (alias `thinking_budget_tokens`), `reasoning_budget_message`, and `reasoning_control`. These are wired only when the template has thinking end tags ([server-common.cpp:1440-1453](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/server-common.cpp#L1440-L1453)). The per-request `reasoning_budget_tokens` name is in source, not in the README.

**Budget sampler** ([reasoning-budget.cpp](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/common/reasoning-budget.cpp)).
- It counts tokens after the start tag.
- When the budget is spent, it forces the end sequence (lines 117–124), waiting for UTF-8 completion first.
- It does this by setting every other logit to −inf (lines 166–186).
- It re-arms on a new start tag (lines 147–159).
- It is attached only when the budget is ≥ 0, a lazy grammar is active, or `reasoning_control` is set ([sampling.cpp:314-321](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/common/sampling.cpp#L314-L321)).

**`reasoning_control` and `reasoning_end`.** I confirmed both in README and source.
- The README documents `POST /v1/chat/completions/control` with `id`, `action: "reasoning_end"`, and `model` (router mode). It returns `{success, message?}`. A finished completion is a no-op (lines 1472–1486).
- The route is registered at [server.cpp:275](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/server.cpp#L275).
- The handler rejects a missing id and any action other than `reasoning_end` ([server-context.cpp:5482-5495](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/server-context.cpp#L5482-L5495)).
- The task returns `success:false` with "no active completion for this id", or "reasoning control not enabled for this completion" when the request did not arm it. Otherwise it calls `common_sampler_reasoning_budget_force` and reports `success: true` ([server-context.cpp:2825-2846](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/server-context.cpp#L2825-L2846)).
- **Gotcha:** the handler ignores the force's return value. `common_reasoning_budget_force` acts only when the sampler is still counting inside a thought ([reasoning-budget.cpp:291-310](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/common/reasoning-budget.cpp#L291-L310)). So `success: true` does not prove that a thought was cut; it may have ended already.

**Cap.** `n_predict` (and `max_tokens`) counts every generated token ([README line 526](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/README.md)). Hitting it gives `finish_reason` `"length"` ([server-task.cpp:374](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/server-task.cpp#L374)).

**Detection.**
- `GET /props` returns `chat_template_caps` (README lines 911 and 925; [server-context.cpp:5157](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/server-context.cpp#L5157)).
- Within it, `supports_reasoning_effort` is true when the Jinja template reads `reasoning_effort` ([caps.cpp:581-583](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/common/jinja/caps.cpp#L581-L583)). `supports_preserve_reasoning` is another field.
- Thinking itself is on when the template supports `enable_thinking` and `--reasoning` is not `off` ([server-context.cpp:1601-1605](https://github.com/ggml-org/llama.cpp/blob/a0e6dc7384edb8f5d927155e1d26c10b4a310e6d/tools/server/server-context.cpp#L1601-L1605)). I found no `/props` field that reports this `enable_thinking` result directly.

## Novita

**Knobs** ([create chat completion](https://novita.ai/docs/api-reference/model-apis-llm-create-chat-completion)).
- `enable_thinking`, default true. It "Only applies to hybrid reasoning models", for example `moonshotai/kimi-k2.5` and `qwen/qwen3.8-flash`. "Models whose reasoning is always on, such as `zai-org/glm-5.3`, ignore this parameter."
- `separate_reasoning` returns the chain of thought in `reasoning_content`.
- The reference lists no `reasoning_effort` and no budget parameter.

**Cap.** For reasoning models, `max_tokens` "can include reasoning tokens as well as visible output tokens". If it is too low, the model "may use the entire budget for reasoning and return empty `content` with `finish_reason: "length"`. Increase `max_tokens` when this occurs." `max_tokens` is required. The default behavior lowers it to fit the context window.

**Detection.** The documented List Models object has no reasoning field ([list models](https://novita.ai/docs/api-reference/model-apis-llm-list-models)). The live `GET https://api.novita.ai/openai/v1/models` (checked 2026-10-14, no key) does return `features: [..., "reasoning", ...]` and `max_output_tokens`. But `zai-org/glm-5.3` (always on), `moonshotai/kimi-k2.5`, and `qwen/qwen3.8-flash` (both switchable) carry the same feature set. **So the API cannot tell an always-on model from a switchable one.** Only the model page says which it is.
