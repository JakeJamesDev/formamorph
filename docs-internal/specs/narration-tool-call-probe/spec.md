# Spec: Cloud Narration Tool-Call Probe

Status: ready-for-agent
Status note: Standalone probe boundary confirmed. Preparation only until the user approves the rendered request and cloud run.
Spec session: 01a0c681-c233-72c1-a86c-b3ad7320df2f

## Problem Statement

Dictionary activation currently happens before narration. New information introduced during a reply cannot guide that reply through a fresh lookup. Before choosing a production design, we need evidence that the cloud narrator can request authored information through native function calls and use it before submitting narration.

An endpoint accepting tool definitions is not sufficient evidence: the model must emit valid calls, accept their results on subsequent requests, and finish through the required output tool. Narration must also remain consistent with the retrieved facts.

## Solution

Build a bounded, reviewable cloud probe in the existing baseline harness. Start with the current default narration prompts and the existing Sedge Landing fixture, exposing entity summaries instead of full descriptions. Offer two native function tools: `request_info` retrieves full authored entity descriptions, and `write` submits the final narration.

First prepare and show the exact initial request offline. After explicit approval to run, execute the main interaction and scene-only control twice each. Preserve the entire tool conversation and report protocol behavior, use of returned facts, elapsed time, and token usage separately. An honest failed or inconclusive experiment is a completed deliverable; model success is not a prerequisite for completing the probe.

## User Stories

1. As a maintainer, I want an offline request preview, so that I can review exactly what will reach the cloud.
2. As a maintainer, I want cloud execution to wait for my approval, so that writing a spec does not start an experiment.
3. As a maintainer, I want the current default narration prompts, so that the result is relevant to our narrator.
4. As a maintainer, I want the current user-message template preserved, so that a different message format does not confound the result.
5. As an author, I want entities initially represented by their authored summaries, so that full descriptions must be retrieved.
6. As a maintainer, I want withheld facts absent from every initial prompt block, so that the model cannot pass through leaked information.
7. As a narrator, I want to request an entity by name or supported alias, so that I can obtain its full authored description.
8. As a narrator, I want several lookups in one response, so that independent information needs can be handled together.
9. As a narrator, I want follow-up lookups after receiving results, so that I can resolve additional information needs.
10. As a narrator, I want an empty result for an unknown term, so that missing information is represented accurately.
11. As a narrator, I want all matching entities for an ambiguous alias, so that the application does not silently guess my intent.
12. As a maintainer, I want automatic tool choice, so that the experiment observes model behavior without API-level forced calls.
13. As a maintainer, I want narration submitted through `write`, so that output-contract compliance is observable.
14. As a maintainer, I want native calls distinguished from function-looking prose, so that text imitation does not count as protocol support.
15. As an author, I want narration checked against returned facts, so that successful retrieval is not confused with faithful portrayal.
16. As a maintainer, I want a scene-only control, so that indiscriminate retrieval is visible.
17. As a maintainer, I want justified control lookups distinguished from unnecessary ones, so that the model can legitimately introduce an entity.
18. As a maintainer, I want malformed and incorrectly sequenced calls preserved, so that failures remain diagnosable.
19. As a maintainer, I want limits on requests, lookups, and duration, so that a looping model cannot run indefinitely.
20. As a maintainer, I want fresh conversations for repeat trials, so that one trial's retrieved information cannot leak into another.
21. As a maintainer, I want raw requests, responses, results, and narration, so that conclusions can be audited.
22. As a maintainer, I want per-request and total timings and usage, so that the cost of extra rounds is visible.
23. As a maintainer, I want credentials excluded from evidence, so that request inspection does not expose authentication material.
24. As a maintainer, I want smoke-test findings clearly scoped, so that a few successful trials are not presented as production readiness.

## Implementation Decisions

### Probe boundary and scope

- Implement an isolated narration experiment in the existing baseline probe harness. Reuse production context and prompt-rendering helpers; do not duplicate their behavior with approximate text substitution.
- The single proposed testing boundary is one complete probe trial: initial request assembly, native tool conversation, local lookups, terminal narration, and captured evidence. The transport can be substituted for offline tests at this boundary.
- Keep the experiment outside the gameplay Turn Pipeline and AI Stream. No gameplay interface, production prompt, world fixture, exported world/save shape, or application default changes are part of this spec.
- Preparation must produce the rendered request without network access. The user must approve cloud execution separately; neither this spec's status nor an implementation instruction alone grants that approval.

### Prompt and context

- Read the current default system and user narration templates when preparing the probe. Record the source revision and exact prompt snapshot with the evidence.
- Render the current-location and sublocation entity blocks in summary mode. Reachable entities already use summaries. Preserve the remaining world, location, Persona, stat, trait, notes, and dictionary sections.
- Use Sedge Landing with Wren at the landing, no prior narration, planning off, English, plain prose, and single-paragraph guidance. This is an isolated narration trial, not a full new-game run.
- Abort offline preparation on unresolved template tokens, summary-to-full-description fallback, or leakage of the selected withheld facts anywhere in the initial messages.
- Replace the system prompt's initial prose-only output sentence with the instruction to submit the finished story through `write`, whose narration argument contains only story prose. Preserve the remaining narrative constraints.
- Add the reviewed entity-information instruction: listings contain summaries; retrieve a listed entity's full description before portraying it; use the returned description with established context; request further entity information as needed; submit the complete narration through `write` when ready.
- This intentionally instructs retrieval. Automatic API tool choice measures compliance with that instruction, not spontaneous discovery of a need for tools without guidance.

### Tool contract

- Supply both tools as native Chat Completions function definitions alongside the messages. Keep tool choice automatic throughout. Do not introduce strict mode, forced function selection, or extra tools for the initial experiment.
- `request_info` accepts exactly one string argument named `term`. `write` accepts exactly one string argument named `narration`. Validate arguments locally, including unexpected fields and empty narration.
- Lookups use trimmed, case-insensitive exact entity names plus explicit aliases: Bram as ferryman; Odette as eel-smoker or woman by the firepit; Rope Ferry as ferry or raft; Tomas as watchman or far-bank watchman; Wick as ferryman's sister.
- Return a matches collection containing each match's identifier, name, and verbatim full authored AI description. An unknown term returns an empty collection. Return all matching entities when an alias is ambiguous. Retrieval makes no model calls.
- Retain the assistant's original tool-call message and append one tool-result message per lookup, correlated by call identifier. Resend the accumulated conversation and both tool definitions for the next round.
- Accept batched or sequential lookups. Count each lookup toward the same trial budget.
- A single valid `write` ends the trial and captures the narration; an additional acknowledgement request is unnecessary.
- A response containing both a new lookup and `write` fails sequencing: its narration cannot have consumed the result that has not yet been returned. Textual ordering inside that response does not establish causality.
- Stop the trial and retain evidence on malformed arguments, unsupported functions, duplicate call identifiers, multiple writes, empty narration, or mixed lookup/write batches. Ordinary story text without `write` fails the output contract. Function-looking text is not a native tool call.
- Do not silently repair responses, inject coaching, retry, or force a final write. Unknown lookups may return an empty result and continue; repeated lookups remain visible and consume the budget. Cap exhaustion is incomplete, not successful.

### Cloud batch and evidence

- Target the hosted cloud chat-completions endpoint with model `default`. Match the existing probe convention of disabled reasoning and the unpinned cloud narration sampler; omit temperature and repetition penalty. Cap each response at 1,024 generated tokens.
- Use non-streaming responses. Run the main case twice, then the control twice, each as a fresh conversation. Limit each trial to four model requests, four lookup calls, and 60 seconds per request. At most 16 model requests are authorized by the proposed batch once approved.
- Stop the batch on an endpoint-level rejection and report the actual error. Do not automatically expand the run into compatibility searches, warm-up calls, token-count requests, local-model tests, or alternate parameter trials.
- Save credential-free exact requests, raw responses, tool results, narration, request count, lookup count, per-request elapsed time, whole-trial duration, and available usage in the existing ignored baseline evidence area. Missing usage remains unavailable rather than being estimated.
- Report observed repeat variability without claiming seed determinism. Aggregate recorded token usage over all model requests in each trial.

## Testing Decisions

### Main case and control

The main action is: “I greet the ferryman and the woman by the firepit, asking them to tell me a little about themselves.” Render it through the current default user narration template. Expect retrieval for Bram and Odette before their portrayal, followed by a valid terminal write. Guarded answers are valid because world canon limits strangers disclosing their names.

The control action is: “I crouch at the edge of the dock and study the pale water beneath it.” Render it through the same template. A direct write is valid when no listed entity is portrayed; if the narrator introduces an entity, assess the lookup against that portrayal rather than treating every lookup as a false positive.

### Observable evidence

| Dimension | Evidence |
|---|---|
| Endpoint acceptance | HTTP outcome and raw response/error |
| Native function calling | Structured tool calls with valid arguments and identifiers |
| Round-trip support | Subsequent model response after correctly correlated tool results |
| Retrieval behavior | Which entities were requested before portrayal, including batching and follow-up requests |
| Output contract | Exactly one nonempty terminal write without unresolved same-response lookups |
| Fact use | Correct use of information absent initially and present in a returned description |
| Fidelity | Contradictions or invented specifics relative to authored descriptions and established scene |
| Selectivity | Retrieved entities compared with those actually portrayed, including control behavior |
| Cost | Measured durations, request and lookup counts, and recorded usage |

Use existing distinctive facts, not invented replacements: Bram has his right arm, a pinned left sleeve, and a brass ring in his left ear; Odette has a right-cheek burn scar, a green glass bead braided into her hair, and counts things twice. Confirm the chosen facts are genuinely withheld before interpreting their appearance as retrieval evidence. Do not require every descriptive fact to appear in ordinary narration. If none appears, fact use is not demonstrated even when the protocol succeeds.

### Offline verification and acceptance

- Prefer the complete probe-trial boundary with an injected scripted transport for deterministic protocol checks. Exercise the real runner, renderer, and lookup handler rather than a test-only reproduction.
- Cover sequential and batched lookups, empty and ambiguous matches, valid terminal write, plain-text imitation, malformed arguments, identifier errors, mixed lookup/write responses, cancellation/timeout, and exhausted budgets. Verify rejected responses remain in evidence and do not trigger unapproved further requests.
- Demonstrate that leaks, fallback descriptions, and unresolved tokens stop preparation before transport is called. The offline mode must make zero network requests.
- Follow existing baseline narration probes and the Sedge Landing fixture as prior art. Measure runtime for every test run; apply the project's normal implementation gates when probe code is built.
- Completing preparation means a reviewable exact request plus offline verification. Completing the approved experiment means an auditable result for every attempted trial, including failures or early batch termination.
- Keep endpoint acceptance, protocol success, retrieval compliance, and fact-use conclusions separate. Two successful trials establish smoke-test evidence only. Do not report unmeasured reliability, model coverage, or gameplay correctness.

## Out of Scope

- Shipping tools in gameplay, changing AI Stream or Turn Pipeline interfaces, or adding settings/UI.
- Changing authored entities, migrating saves, changing export formats, or bumping the application version.
- Replacing dictionary activation or implementing semantic search.
- Streaming tool-call assembly, narration reveal, or TTS integration.
- Local-model runs, a full-description comparison arm, broad endpoint compatibility testing, or longer-session experiments.
- Automatic prompt tuning, response repair, or expanding the approved batch after a failure.

## Further Notes

The [prior probe plan](D:/Documents/GitHub/formamorph/docs-internal/notes/lorebook-generation-research/tool-call-probe-plan.md) contains the exact draft prompt wording, tool schemas, and an illustrative successful conversation. Its example is not an observed cloud result. Review the final rendered request before execution even if the implementation follows this spec, because the production templates may change between preparation and the run.

This spec is the tracked implementation scope. The [earlier research](D:/Documents/GitHub/formamorph/docs-internal/notes/lorebook-generation-research/notes.md) and probe plan remain supporting design material. A future production decision requires further evidence beyond this experiment.

The standalone probe does not alter the [Turn Pipeline's existing seams](D:/Documents/GitHub/formamorph/docs/adr/0001-turn-pipeline-seams.md) or add model calls to the [offline Test Bench](D:/Documents/GitHub/formamorph/docs/adr/0005-test-bench-shows-computation-never-model-judgment.md).

## Comments

September 22, 2026 — The user confirmed the standalone baseline probe boundary: production prompt rendering, a complete request_info/tool-results/write trial, and offline checks using a scripted transport. Cloud execution remains pending separate approval.
