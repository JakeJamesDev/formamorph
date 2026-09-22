# Tool descriptions, formats, and evaluation

Live primary-source review, September 22, 2026. This note separates published measurements, provider recommendations, and proposed Formamorph experiments. No production prompt changes.

## What experts have measured

### Format matters, but there is no universal winning language

Berkeley's BFCL V4 format-sensitivity study tested 39 models across 26 prompt variants and 200 single-turn cases. Python and JSON call outputs generally performed better than XML, particularly for smaller models. JSON function documentation was generally strongest. Markdown versus plain text and paraphrased instructions showed no consistent overall trend. Some specialized tool models suffered severe failures when asked to use unfamiliar output formats or extra tags. [BFCL authors' report](https://gorilla.cs.berkeley.edu/blogs/17_bfcl_v4_prompt_variation.html)

Limitations: the selected study excludes multi-turn, Java, and JavaScript categories. It does not settle JavaScript variadic versus array arguments, nor our complete retrieval-to-narration loop. Its prose and figure caption disagree about the relative ordering of Python/XML documentation; the shared finding is that JSON documentation performed best. These results concern programming/serialization formats, not English versus other natural languages. [Study design and results](https://gorilla.cs.berkeley.edu/blogs/17_bfcl_v4_prompt_variation.html)

**Implication for our 11/12 versus 11/12 result:** the tie is useful local evidence, but cannot establish equivalence or a general model preference. A text-call syntax test and native tool-call test measure different interfaces.

### Examples can improve argument handling

Anthropic reports internal complex-parameter accuracy improving from 72% to 90% with tool-input examples. The examples demonstrate conventions, nested structures, and relationships among optional parameters. It recommends them particularly for complex or domain-specific inputs, less so for obvious single-parameter tools or constraints already expressed by a schema. This is a vendor-reported result on its own testing, not evidence of the same gain for MeroMero. [Anthropic engineering](https://www.anthropic.com/engineering/advanced-tool-use)

## What providers recommend

### Describe the decision, not just the operation

Anthropic's tool-definition guide calls for explicit purpose, when to use a tool, parameter meanings, output, and relevant limitations. It recommends detailed descriptions, with examples for complex inputs. Its suggested description length is Claude-specific guidance rather than a proven optimum for our local models. [Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)

The engineering guidance emphasizes clear purposes, unambiguous names such as `user_id` rather than `user`, strict input models, and high-signal results. It reports that even prefix versus suffix naming effects vary by model and recommends evaluating the choice. It also recommends tools that return the context needed for a task instead of exposing every low-level API operation. [Writing effective tools](https://www.anthropic.com/engineering/writing-tools-for-agents)

### Preserve the model's expected tool format

Google's Gemma 4 example supplies tool definitions to `apply_chat_template`; the rendered model input/output uses dedicated tool declaration, call, and response tokens. Google explicitly recommends its illustrated history structure so the chat template generates the expected result-token structure. Its example supports multiple independent tool responses. The application-facing JSON and the model-facing serialized format are therefore distinct layers. [Gemma 4 function calling](https://ai.google.dev/gemma/docs/capabilities/text/function-calling-gemma4)

**Application inference:** verify the actual model/template/server combination before attributing failures to the wording. Gemma-family documentation alone does not verify a particular MeroMero fine-tune or LM Studio parser.

Google also distinguishes two history boundaries: retain thoughts between tool calls within one model turn, but strip completed-turn thoughts before the next user turn. This is important when comparing thinking-enabled loops: preserving a response field in client JSON does not by itself establish how the server's template renders it. [Gemma thinking documentation](https://ai.google.dev/gemma/docs/capabilities/thinking#multi-turn_example_with_thought_stripping)

## Proposed description baseline for our experiment

This is an application-specific proposal derived from the guidance above, not a provider-prescribed prompt. Keep the chosen native or text-call syntax consistent throughout the examples and parser.

> Retrieve full authored descriptions for the named world entities. Use this when preparing to portray an entity whose full description has not been returned by this tool; the short scene summary is not its full description. Supply the entity names shown in the available-entity list. Results identify each requested name and its matches, including requests with no match.

This description deliberately explains what information is missing and how it becomes available. The story prompt should separately decide which characters belong in the scene. The distinction avoids using a retrieval tool description to rewrite narrative direction.

For `write`, a candidate description is: “Deliver the finished narration to the player. Supply the narration text after gathering the information needed for this turn.” Enforcing whether ordinary prose is accepted remains the harness's job.

## Evaluation baseline

Anthropic recommends multiple trials, inspecting transcripts, grading the actual outcome, and combining deterministic checks with human or calibrated model judgments when needed. It distinguishes the agent harness plus model from a model alone, and warns that rigid checks can reject valid alternatives. [Demystifying agent evaluations](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

Proposed Formamorph application:

1. Freeze model, template, endpoint, sampler, thinking setting, and adequate output budget. Record those with every transcript.
2. Separate three experiments: syntax validity; correct retrieval selection; complete narration delivery. Do not infer one from another.
3. Include zero-, one-, and multiple-entity cases, already-retrieved descriptions, unknown names, ambiguous matches, and a follow-up lookup prompted by returned lore.
4. Change descriptions alone first; then test a few valid examples independently. Keep held-out scenes to detect overfitting to Bram/Odette.
5. Measure valid arguments, required and unused retrievals, successful `write`, use of retrieved facts, latency, tokens, and recovery attempts separately.
6. Report denominators and uncertainty; interleave variants and repeat trials. Review failures manually, especially when the narrative allows several reasonable character selections.

Syntax validity can be checked mechanically. Whether a scene needed a character, respected authored lore, and fulfilled the player's action needs a stated rubric and human review; a smaller call count alone is not success.
