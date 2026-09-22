# Reasoning prompt guidance

Primary sources checked September 22, 2026. This note separates native thinking controls from instructions requesting visible explanation. Provider recommendations are starting points; transfer to MeroMero requires measurement.

## Google Gemini

Google says native Gemini thinking generally makes a returned outline, plan, or explanation of reasoning unnecessary. Requests to think harder can help difficult problems but consume more thinking tokens. It recommends direct goals, clear constraints, and consistent Markdown or XML sections. Critical behavior and output requirements belong in system instructions or at the beginning; with long context, put the context before the specific final question. These are complementary placement rules for enduring behavior versus the current task. [Prompt design strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)

The thinking guide recommends choosing effort by task complexity. Its current API distinguishes `thinking_level` from `max_output_tokens`: the latter cuts off the combined thinking and answer, without changing effort allocation. Lowering the total cap can therefore leave an incomplete or empty answer. Returned thought summaries also differ from the full underlying thinking counted for usage. [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking)

**Implication for Formamorph:** output length, reasoning effort, and total completion cap are separate controls. A short final paragraph requirement does not itself establish short reasoning. This is an inference from the API distinction, not a tested MeroMero guarantee.

## Google Gemma 4 and MeroMero

The MeroMero v2 author's model card identifies **Gemma 4 31B** as its base and supports thinking and nonthinking use. Its own roleplay evaluation reports **341 mean / 305 median words per thinking block**, versus 263 / 253 for stock Gemma 4. These are author-reported words, not our token measurements, and use different prompts. Nevertheless, lengthy thinking is also documented outside our harness. [MeroMero v2 author model card](https://huggingface.co/zerofata/G4-MeroMero-v2-31B)

Gemma's native thinking control is a template token at the beginning of the system prompt; Google documents the model's reasoning channel separately from the answer. This is distinct from adding ordinary prose asking the model to explain itself. Runtime/template support should handle those tokens. [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4)

Google specifically recommends **system instructions requesting efficient or lower-depth thinking** for Gemma 4. It reports approximately 20% fewer thinking tokens in its tests, but describes this as a proof of concept with no single perfect prompt. That percentage is not a prediction for MeroMero or Formamorph. The page provides guidance rather than an exact universal low-thinking sentence. [Gemma 4 prompt formatting](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4)

The same formatting documentation specifies:

- Consolidate thinking configuration and other system instructions into one system turn.
- Remove raw thoughts from completed ordinary conversation turns.
- **Preserve thoughts between function calls within the same model turn.**

These are Gemma-specific integration requirements, not generic rules for every provider. A reasoning-history mistake is worth checking before interpreting repeated planning as purely a wording problem. No integration defect is established by this research. [Gemma 4 prompt formatting](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4)

## Qwen: a portability counterexample

The official hybrid Qwen3-32B card distinguishes the template's hard `enable_thinking` control from `/think` and `/no_think` soft switches in user or system messages. The latest soft instruction wins when thinking is enabled; soft instructions cannot override the hard disabled mode. Its thinking sampler recommendations also warn against greedy decoding because of degradation and endless repetition. These are **Qwen3-specific**, not instructions to copy into MeroMero. [Qwen3-32B model card](https://huggingface.co/Qwen/Qwen3-32B)

The same card says historical conversation output should contain the final answer without thinking content, with templates normally handling that separation. This should not be generalized into removing all reasoning from every tool round: Gemma's documentation explicitly makes a same-turn function-call exception, and other providers have their own protocols. [Qwen3-32B model card](https://huggingface.co/Qwen/Qwen3-32B)

## OpenAI: native reasoning versus prompted reasoning

OpenAI recommends simple, direct prompts for native reasoning models and says explicit step-by-step or reasoning-explanation requests are unnecessary. It recommends clear response constraints and success criteria. This supports beginning with a task contract instead of a prescribed reasoning ritual. [Reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices)

Its GPT-4.1 guidance explicitly describes that model as nonreasoning and recommends a short chain-of-thought cue at the end when that technique is useful. This is a model-specific recommendation, not evidence that every native reasoning model needs the same cue. For long context, that guide recommends instructions at both ends, or above context if included only once. [GPT-4.1 guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-4.1)

General OpenAI guidance puts enduring application rules in developer messages and user input in user messages. It suggests identity, instructions, examples, then context, while explicitly noting that optimal order varies by model. There is no basis here for declaring our late Preparation section universally optimal. [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)

Reasoning effort and total output allowance are distinct. OpenAI documents that exhausting the total output allowance can end generation before visible output, which is a reason to distinguish effort tuning from truncation. [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)

## Anthropic: broad guidance and over-verification

Anthropic recommends general thinking instructions over prescribing every mental step. It documents that large or complex system prompts can trigger excessive thinking and gives guidance favoring direct responses when extra reasoning would not materially improve quality. Its self-check advice is model-dependent: it explicitly warns that inherited verification instructions can make certain models over-verify. None of that proves a particular wording will work on MeroMero. [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)

## Practical synthesis for Formamorph

**Recommendation, not a verified prompt:** use Gemma's documented efficient-thinking system guidance as the starting point for MeroMero, preserve the proven retrieval condition, and keep the requested final artifact explicit. The existing detailed decision-notes contract is an experiment, not an industry standard.

An illustrative efficiency instruction is: “Use brief reasoning proportional to the difficulty of the current action. Spend additional reasoning on unresolved facts or continuity conflicts. Once these are resolved, produce the narration.” This is original wording adapted from the guidance, not Google's published sentence or a tested improvement.

Place enduring workflow and output rules in the provider-supported system/developer instruction area. Keep the latest player action at the end of the conversation, after relevant context/history. Use a short labeled workflow section for readability; its heading does not activate a native reasoning mode. Follow the serving template for mode control and tool round-trips. Treat exact placement as a model-specific evaluation variable rather than moving sections and changing wording simultaneously.

Avoid importing lengthy agent-planning templates indiscriminately. Google's large reasoning template is explicitly aimed at complex rulebook-driven agentic benchmarks, and its agent guidance notes that persistence can cause higher costs or loops. That is different evidence from short narration quality. [Gemini prompt strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)

The priority is to distinguish useful retrieval/continuity decisions from repeated drafts and checks. The [decision-notes experiment](decision-notes-findings.md) improved delivery but increased total thinking tokens. Research supports reconsidering the amount of prescribed preparation before assuming an additional prohibition is the best next change. No new test is authorized or run by this note.

## Limits

- Native thinking, visible scratchpads, and final-answer explanations are different outputs. A prompt that asks for an explanation creates an additional deliverable.
- Neither Google's efficient-thinking guidance nor MeroMero's card establishes that a detailed preparation checklist reduces drafting in our workload.
- No universal English wording or universal section position was established by these sources.
- No model inference or application changes were performed for this research.
