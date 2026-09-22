# 03: Run the LM Studio Tool-Call Comparison

Status: ready-for-human
Status note: Follow-up experiment explicitly requested after the hosted endpoint rejected automatic tool choice.
Base: 3072b16fdffb17e570e79f221a59443698764f0d
Blocked by: 01
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: medium
Spec session: 01a0c85d-e6fd-7381-bf98-e78e0f98b2f3

## Parent

[Cloud Narration Tool-Call Probe](D:/Documents/GitHub/formamorph/docs-internal/specs/narration-tool-call-probe/spec.md)

## What to build

Extend the standalone narration tool-call probe with an explicit LM Studio execution mode, then run the same two-main/two-control experiment against the loaded `rocinante-x-12b-v1` model. Keep this as a separate local comparison rather than changing or retrying the completed cloud batch.

## Acceptance criteria

- [ ] Preserve the cloud request and offline-preview defaults exactly; local execution requires an explicit CLI mode and model ID.
- [ ] Target `http://127.0.0.1:1234/v1/chat/completions` with the loaded `rocinante-x-12b-v1` model and a fixed seed recorded in every request.
- [ ] Keep both native tools, automatic tool choice, non-streaming responses, disabled reasoning, the 1,024-token cap, unchanged narration sampler behavior, fresh conversations, four requests and four lookups per trial, and 60-second request timeouts.
- [ ] Run two main trials followed by two scene-only controls, stopping on endpoint rejection and making no retries, forced calls, coaching, response repairs, warm-ups, or compatibility substitutions.
- [ ] Preserve credential-free exact requests, raw responses, correlated tool results, narration, timings, counters, and available usage in the ignored baseline evidence directory.
- [ ] Add focused tests for the parameterized model and seed without duplicating the runner. Prove the new assertions fail when either field is not carried into the request, then restore the source.
- [ ] Publish a concise local findings report that keeps endpoint acceptance, native calls, round trips, lookup compliance, terminal-write compliance, retrieved-fact use, and narration fidelity separate for every attempted trial.
- [ ] Leave production prompts, authored fixtures, application defaults, export shapes, and version unchanged.

## Completion condition

A documented local success, model-level protocol failure, or endpoint rejection completes this ticket. The comparison remains a four-trial smoke test and does not establish production readiness or a reliability rate.

## Comments

September 22, 2026 — The user approved implementing the local option and running the bounded comparison. LM Studio's local model API reported `rocinante-x-12b-v1` as the only loaded LLM and marked it trained for tool use.

September 22, 2026 — LM Studio accepted all four requests, but the model returned prose directly with zero native calls, zero lookups, and no terminal `write`. All four trials were classified `missing_write`; see the [local findings report](D:/Documents/GitHub/formamorph/docs-internal/specs/narration-tool-call-probe/local-findings.md).
