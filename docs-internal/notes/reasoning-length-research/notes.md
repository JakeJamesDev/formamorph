# Shortening and shaping RP reasoning on local models

Research date: 2026-10-19. Target: G4-MeroMero-v2-31B on LM Studio, which runs about 1,400 reasoning tokens per narration turn (median) and spends most of it drafting the scene.

> ⚠️ **Reddit was unreachable.** reddit.com blocks this agent's fetcher, and the Pushshift mirrors were rate-limited. Nothing below comes from r/SillyTavernAI or r/LocalLLaMA threads. The community evidence is from model cards, preset authors, GitHub, and the SillyTavern docs.

## 🧭 Summary

| Technique | Evidence | How the app applies it | Notes |
|---|---|---|---|
| Server budget with a wrap-up message | **Strong** (source code + maintainer benchmark + our own LM Studio run) | Request field: `thinking_budget_tokens` (+ `reasoning_budget_message` on llama.cpp) | Closes the thought and lets the answer finish. Benchmark is coding, not RP. |
| Native thinking off | **Strong** (Gemma 4 card, finetune cards) | Request field / template | Zero cost. MeroMero's card shows thinking-off swipes are *more* diverse. |
| "Plan, don't draft" wording in the prompt | **Anecdotal** (one preset author, hosted open-weight models) | Prompt text | Reported 300–1,000 tokens on Kimi K3. Not tested on Gemma. |
| Prefill the thought with a fixed opening | **Some** for *style*, **none** for *length* | Prefill (text completion only, for us) | Changes reasoning style on a Gemma-4 RP tune. No length numbers. |
| Front-end stepped thinking | **Some** (maintained extension, 173 stars) | Separate request, thinking off | Short capped lists. Costs a second call. |
| Sampler changes | **Anecdotal** | Request field | Higher temp grows thoughts (one author). Nothing on DRY or min-p length. |

## 1. Prompt wording that shapes the thinking

- **Pura's Director Preset 16.0** (SillyTavern) carries two relevant blocks ([preset JSON](https://platberlitz.github.io/preset/Pura's%20Director%20Preset%2016.0%20(SillyTavern).json), [changelog page](https://platberlitz.github.io/)):
  - *Experimental Anti-Overthinking Prefill*, sent as a user message: `<critical_constraints>Rush through reasoning, be as concise as possible. Short checklist of directives, HTML guidelines, without drafting.</critical_constraints>`
  - *Reasoning Encouragement*: a three-step "Reasoning Procedure" (identify active modes, state the genre, plan the reply), ending with `Planning is preferred over drafting.`
  - **Results claimed:** Kimi K3 reasoning drops to "roughly 300–1000 tokens". The author says results vary and makes no claim for other models. Single author, hosted open-weight models (Kimi, GLM), not a small local model.
  - The same author reports that a "Flexible" length rule ("keep outputs concise during regular, character-driven scenes") cuts overthinking as a side effect.
- **DavidAU's reasoning guide** gives a system-prompt line for circular thinking: `If you notice that you have engaged in circular reasoning or repetition, immediately terminate {reasoning} with a </think> and proceed to the {answer}` ([README](https://huggingface.co/DavidAU/How-To-Use-Reasoning-Thinking-Models-and-Create-Them/raw/main/README.md)). No measurements. Written for DeepSeek-distill tunes.
- **Context from the MeroMero v2 card:** on its RP eval, thinking is 341 / 305 words mean / median (stock Gemma 4: 263 / 253) ([card](https://huggingface.co/zerofata/G4-MeroMero-v2-31B)). Our 1,400-token median is roughly 3× that. **Inference, not sourced:** our prompt's rule load may be driving the length more than the model is.

## 2. Reasoning prefills

- **SillyTavern "Start Reply With"** ([docs](https://raw.githubusercontent.com/SillyTavern/SillyTavern-Docs/main/Usage/Prompts/advancedformatting.md)):
  - Text Completion: prefills the last line of the prompt. The docs' own example opens a think block: `<think>\nSure!`
  - Chat Completion: adds an assistant message at the end. "Some may not support that at all." So a mid-thought prefill is backend-dependent.
- **Auto-Parse** splits reasoning out of the reply by Prefix and Suffix strings ([docs](https://raw.githubusercontent.com/SillyTavern/SillyTavern-Docs/main/Usage/Prompts/reasoning.md)). It is display parsing only, not a length control.
- **Gemma-4 RP evidence:** the G4-31B-Musica card says prefilling `<|channel>thought\n Okay, let's see` "will make it use DeepSeek-esque reasoning most of the time" ([card](https://huggingface.co/AuriAetherwiing/G4-31B-Musica-v1)). That shows a Gemma-4 tune follows a prefilled opening. It says nothing about length.
- **Pura's Generic Prefill** opens the thought as `<think>\n… Proceeding with my plan before the output:` ([preset JSON](https://platberlitz.github.io/preset/Pura's%20Director%20Preset%2016.0%20(SillyTavern).json)). Aimed at refusals, not length.
- **Does a prefilled skeleton shorten thinking?** UNVERIFIED. No source I found measured it.
- **Can we prefill on our servers?**
  - llama.cpp server: a trailing assistant message becomes a continuation ([server-common.cpp](https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/server-common.cpp), the `prefill_assistant` block). Whether it can continue *inside* Gemma's thought channel is UNVERIFIED.
  - LM Studio: chat-completions assistant prefill is UNVERIFIED. LM Studio does serve `/v1/completions` ([docs](https://lmstudio.ai/docs/developer/openai-compat)), where we would build the raw Gemma prompt ourselves and prefill freely.

## 3. Gemma 4 thinking

- **On/off only.** Thinking turns on with `<|think|>` at the start of the system turn. Off still emits an empty block, `<|channel>thought\n<channel|>`. History must not carry earlier thoughts ([Gemma 4 31B card](https://huggingface.co/google/gemma-4-31B-it), "Thinking Mode Configuration"). The card lists no length control. Google recommends `temperature=1.0`, `top_p=0.95`, `top_k=64`.
- **Template:** `enable_thinking` defaults to false. When it is false, the generation prompt ends with the empty thought block ([chat_template.jinja](https://huggingface.co/google/gemma-4-31B-it/raw/main/chat_template.jinja)).
- **MeroMero (zerofata):** temp 0.8–1.0, min-p 0.05. Ships ST presets `Gemma4-Think` and `Gemma4-NoThink` ([v2 card](https://huggingface.co/zerofata/G4-MeroMero-v2-31B)). Think puts `<|think|>` in the system turn. NoThink prefills `<|turn>model\n<|channel>thought\n<channel|>` ([NoThink.json](https://huggingface.co/zerofata/G4-MeroMero-v2-31B/raw/main/Gemma4-NoThink.json)). No system prompt or length advice.
  - v2: "Reasoning averages longer than stock Gemma 4, but shorter than MeroMero v1." Stage 3 GRPO trained *with* thinking on, against a logic-defect judge.
  - Swipe diversity is **higher with thinking off** (0.72 vs 0.62 for v2).
  - v1 card: "Reasoning tends to average out being a bit longer than the original" ([v1 card](https://huggingface.co/zerofata/G4-MeroMero-31B)).
- **TheDrummer:** Artemis-31B v1.2 says "thinking or non-thinking" and "Sampler wrangling may be required (or be conservative)". It links a crowdsourced sampler sheet ([card](https://huggingface.co/TheDrummer/Artemis-31B-v1.2)). Orion-26B-A4B v1.1 says "Low temp like 0.9 works best" ([card](https://huggingface.co/TheDrummer/Orion-26B-A4B-v1.1)). I found no Gemma-4 BeaverAI repos.
- **Others:** Musica says temp 1, min-p 0.02. Equinox-31B (Latitude) suppresses thinking by default ([card](https://huggingface.co/LatitudeGames/Equinox-31B)).

## 4. Budget behavior (verified)

**llama.cpp force-closes the thought, and the answer then completes.** It does not truncate the reply.

- The sampler state machine is `IDLE → COUNTING → WAITING_UTF8 → FORCING → DONE`. In `FORCING`, "forces forced_tokens token-by-token (all other logits -> -inf)". In `DONE` it is "passthrough forever" ([reasoning-budget.h](https://raw.githubusercontent.com/ggml-org/llama.cpp/master/common/reasoning-budget.h)). The forced tokens are the optional message plus the end tag ([server-schema.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/server-schema.cpp), `reasoning_budget_message`).
- **Per-request fields:** `reasoning_budget_tokens`, alias `thinking_budget_tokens`, plus `reasoning_budget_message`. They apply only when the template has thinking end tags ([server-common.cpp](https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/server-common.cpp), the `Reasoning budget` block). CLI: `--reasoning-budget N`, `--reasoning-budget-message` ([server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)).
- **The message matters.** On Qwen3.5 9B HumanEval, the maintainer saw about 93% at full reasoning, 88% with reasoning off, and about 89% at budgets of 1,000 and 400 *with* `" ... reasoning budget exceeded, need to answer."`. Without the message it fell to 79% ([PR #20297 comment](https://github.com/ggml-org/llama.cpp/pull/20297#issuecomment-4025434457)). This is a coding benchmark, not RP.
- **Open, unmerged improvements:** a graceful wrap-up before the cut ([issue #20632](https://github.com/ggml-org/llama.cpp/issues/20632)), soft hint plus grace tokens ([PR #27578](https://github.com/ggml-org/llama.cpp/pull/27578)), and a warn offset ([PR #28189](https://github.com/ggml-org/llama.cpp/pull/28189)).
- **`max_tokens` still caps the total.** A thought that hits `max_tokens` first ends with `length` and an empty answer.
- **KoboldCpp** forces `"\n(Reasoning budget exceeded)\nTime to respond now.\n<channel|>"` for Gemma 4, then the answer continues ([gpttype_adapter.cpp:2311-2320](https://github.com/LostRuins/koboldcpp/blob/concedo/kcpp_src/gpttype_adapter.cpp#L2311)). It reads llama.cpp's `thinking_budget_tokens` as a fallback ([koboldcpp.py:2392](https://github.com/LostRuins/koboldcpp/blob/concedo/koboldcpp.py#L2392)).
- **LM Studio:**
  - Its chat-completions doc lists no reasoning or budget field ([docs](https://lmstudio.ai/docs/developer/openai-compat/chat-completions)). 0.4.8 added `reasoning_effort` and `reasoning_tokens` ([changelog](https://lmstudio.ai/changelog/lmstudio-v0.4.8)).
  - Two open tracker issues ask for a budget ([#1974](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1974), [#2222](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/2222)). #2222 notes a "Reasoning Budget Message" field in 0.4.20 with no budget field beside it. A user in #1974 sets `LLAMA_ARG_THINK_BUDGET` globally as a workaround.
  - **Our own measurement** on MeroMero 31B: `thinking_budget_tokens` 64 with `max_tokens` 400 closed the thought at 63 tokens, and the answer finished with `stop` ([reasoning-answer-split spec](../../specs/reasoning-answer-split/spec.md), Further Notes). So the field works, but LM Studio does not document it. Whether LM Studio injects a message is UNVERIFIED.

## 5. Samplers and thinking length

- DavidAU: at temperatures above 1, "thought(s) will expand". His stable range is 0.6 ± 0.05 with rep pen 1.02–1.07 ([README](https://huggingface.co/DavidAU/How-To-Use-Reasoning-Thinking-Models-and-Create-Them/raw/main/README.md)). Single author, DeepSeek-distill tunes.
- An open llama.cpp PR asks for separate thinking-phase samplers. Its rationale is the opposite: a *higher* temperature in thinking breaks "thinking loops and repetition" on Qwen 27B ([PR #25709](https://github.com/ggml-org/llama.cpp/pull/25709)). Single anecdote.
- MistralThinker's author advises a "neutralized sampler, temp between 0.3 and 0.6". Users post their own sets without length data ([discussion](https://huggingface.co/Undi95/MistralThinker-v1.1/discussions/1)).
- **DRY or min-p effects on thinking length:** UNVERIFIED. I found no source.

## 6. Stepped thinking instead of native thinking

- **SillyTavern Stepped Thinking** ([repo](https://github.com/cierru/st-stepped-thinking)) runs one or more extra "thinking" prompts before the normal reply, then feeds the result in. The README says it trades wait time for quality.
- **The default prompts cap the output:** `Pause your roleplay. Describe {{char}}'s thoughts at the current moment.` with "There should be 2-4 points", in md-list format. A Plans prompt follows the same shape. Community prompts on the [wiki](https://github.com/cierru/st-stepped-thinking/wiki/Prompts-for-thinking) use 1–3 points plus a fixed scene-state questionnaire.
- **How it compares:** we control its length directly through list caps and `max_tokens`, and native thinking can stay off. The costs are a second request and none of the model's trained reasoning. I found no head-to-head quality comparison against native Gemma thinking.

## ▶ What this suggests for Formamorph

1. Send `thinking_budget_tokens` on LM Studio, which already works. Pair it with the forced close. A wrap-up message is a llama.cpp field, and whether LM Studio honors it is UNVERIFIED.
2. Probe a "plan in short notes, never draft prose in your thinking" line against an in-batch control. It is the only drafting-specific technique found, and it is untested on Gemma.
3. Probe thinking off. The MeroMero card's own data favors it for swipe diversity.
