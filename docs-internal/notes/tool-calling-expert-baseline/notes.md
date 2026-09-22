# Expert baseline for reliable lore tools

Research date: September 22, 2026. Research only; no production prompt or harness changes. See the companion [description and evaluation evidence](description-and-evaluation-sources.md) for the cross-model study and Anthropic/Google sources.

## Recommendation

Use the model's supported native tool format, explain the information each tool supplies and when it is needed, validate every call, and provide bounded error recovery. Measure syntax, retrieval decisions, and completed narration separately. These are proposed Formamorph applications of the sources below, not guarantees for MeroMero.

Our next baseline should establish those foundations before spending more trials on JavaScript punctuation. The existing [syntax experiment](../../specs/narration-tool-call-probe/syntax-findings.md) tied at 11/12 per format; it does not establish a general preference or measure native tool calling.

## Different failures need different controls

| Failure | Proposed control | Remaining limitation |
|---|---|---|
| Malformed arguments or wrong types | Supported schema-constrained generation and application validation | A valid string can still name the wrong entity |
| Missing or unnecessary lore lookup | Clear information boundary and selection instructions | Relevance remains a model decision |
| Prose instead of `write` | Supported tool-choice control; harness accepts only valid `write` as completion | Forcing a tool does not choose the right tool |
| Unknown or ambiguous entity | Explicit lookup result and bounded correction opportunity | The application must define matching semantics |
| Thinking exhausts the response budget | Record finish reasons and budgets separately from call errors | More tokens do not establish better task performance |
| Server cannot parse generated calls | Verify template, parser, and actual rendered history | API compatibility alone does not establish native support |

## What the interface can enforce

OpenAI documents strict function schemas, with required properties and closed objects; it distinguishes optional tool use (`auto`), mandatory tool use (`required`), and a forced named function. This separates argument shape from whether a call happens. It also recommends meaningful parameter descriptions, simple interfaces, and moving known work into application code. [Function calling](https://developers.openai.com/api/docs/guides/function-calling)

Schema adherence is not semantic correctness. OpenAI explicitly notes that structured outputs can still contain mistakes, including invented values when the task does not fit the schema. Design an honest empty/unsupported outcome where appropriate. [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

**Application proposal:** because our experiment requires every final narration to use `write`, test `required` with both tools available on endpoints that support it. This still lets the model choose retrieval or completion. Do not force `write` before it has gathered the needed lore. Continue validating calls and finish reasons locally.

**UNVERIFIED — endpoint controls:** this research did not test strict tool schemas or mandatory tool choice on our current LM Studio/model combination or cloud endpoint. OpenAI's guarantees cannot be transferred to an OpenAI-compatible server by assumption.

LM Studio distinguishes native tool handling from its fallback prompt format. Native handling requires both a suitable model template and server support for parsing its format; fallback quality varies by model. Its documentation points to `lms log stream` for inspecting model input. [LM Studio tool use](https://lmstudio.ai/docs/developer/openai-compat/tools)

LM Studio separately documents grammar-constrained JSON response content through `response_format`. That feature is not evidence that a particular tool-call configuration honors `strict` or `required`. [Structured output](https://lmstudio.ai/docs/developer/openai-compat/structured-output)

## Describe the missing information

Our probe's current description says it retrieves full descriptions by name or keyword. The crucial missing explanation is why a summary is insufficient for the upcoming portrayal. A useful tool contract needs four answers:

- **Purpose:** what information becomes available?
- **Trigger:** when does that information matter for the task?
- **Arguments:** which identifiers or names can the model supply?
- **Result:** how are matches, missing entries, and ambiguity represented?

The companion note provides the provider evidence. This candidate is our own proposed baseline, to adapt to the actual lookup semantics and chosen parameter format:

> Retrieve full authored descriptions for world entities you plan to portray. The available summaries identify entities but omit their detailed lore. Use this tool when that entity's full description is not already in context. Supply names from the available-entity list.

Describe the actual return shape alongside that contract once finalized. Do not promise semantic keyword search unless the implementation provides it. Keep the narrative decision about who belongs in the scene in the narration instructions; listing an entity should not automatically require introducing it.

For `write`, a candidate is:

> Deliver the finished narration to the player after gathering the information needed for this turn.

The narration parameter should identify the expected player-visible content. Neither description needs to recite validation rules that the schema or dispatcher already enforces.

## Recovery is part of the interface

Pydantic AI illustrates a concrete repair loop: argument validation failures and tool errors become feedback to the model, which can issue a corrected call. Its documentation distinguishes these from retrying a failed HTTP request. It also shows why per-tool retry limits alone may not bound an entire run. [Retry behavior](https://pydantic.dev/docs/ai/core-concepts/retries/)

**Application proposal:** reject invalid input before execution, return the specific failure with its call ID, and allow a small correction budget plus a total loop limit. Keep first-attempt success separate from recovered success. Do not silently reinterpret malformed arguments in ways that change their meaning; a comma may be part of an entity's name. Missing lore should remain visibly missing rather than becoming fabricated canon.

## Next experiment, in order

1. Record model, template, parser behavior, rendered history, thinking mode, and supported enforcement controls. Check same-turn reasoning history when thinking is enabled; see the Google evidence in the companion note.
2. Freeze that configuration and compare the existing description with the information-focused candidate. Keep parameter syntax unchanged for this comparison.
3. Test a small set of valid examples separately, rather than combining examples and description changes into one unexplained improvement.
4. Exercise unknown names, multiple lookups, already-fetched lore, no-needed-lookup scenes, and follow-up retrieval prompted by returned lore. Include held-out entities and scenes.
5. Report valid arguments, missed/unnecessary retrievals, lore fidelity, `write` completion, first-pass versus recovered success, latency, and token use independently.

The cross-model evidence supports treating serialization as model-dependent. It does not establish a winner between our two JavaScript forms, nor an English-versus-other-natural-language preference. Our strongest baseline is an accurate tool contract carried through the model's supported interface, followed by task-level evaluation.
