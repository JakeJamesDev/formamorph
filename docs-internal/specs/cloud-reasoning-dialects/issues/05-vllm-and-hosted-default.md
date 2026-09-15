# 05: vLLM And The Hosted Default

Status: ready-for-human
Status note: Built and committed. Four gates green. Reviewed on both axes; findings folded in, two rejected with evidence (see Comments).
Base: c4901429
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Cloud Reasoning Dialects](../spec.md)

**What to build:** A player on a vLLM server with a reasoning parser gets the budget slider once one reply has shown separated reasoning, and each request then carries `thinking_token_budget`. A player on a vLLM server without a parser, including the hosted Default's Aphrodite server, sees no Native Reasoning controls, because nothing proves the server separates its reasoning.

**Rationale for the model:** one dialect row already exists from ticket 01; this adds the observation gate and the Aphrodite rule. Sonnet at medium effort.

## Acceptance criteria

- [x] A vLLM or Aphrodite models-list shape names the vllm dialect with budget unknown and reasons unknown.
- [x] An observed reply carrying a separate reasoning field marks budget yes on a vllm dialect. An observed reply with reasoning only in prose, under a positive effort, marks reasons no, as the existing observation rule does.
- [x] Until a reply proves separated reasoning, a vllm-dialect target shows no budget slider and no effort dropdown, and sends no reasoning field.
- [x] The hosted Default, checked live, resolves to no controls and sends no reasoning field after one turn.
- [x] Request-spec tests cover vllm with budget yes and with budget unknown. Resolver tests cover the models-list shape, the reasoning-field observation, and the prose-only observation.
- [x] Typecheck, lint, tests, and build pass; report test wall time; prove the observation gate test fails when budget is marked without a reply. Update the code graph. Changelog In Progress entry, 👤 bucket, under the Native Reasoning group.

## Scope notes

No change to the hosted Default's server. The spec's note about its missing reasoning parser stands for its operator.

## Comments

**2026-09-15 — built, reviewed, handed over.**

Every acceptance criterion is met. The gate is a dialect row property, `controlsNeedProof`, rather than a
name check on `vllm`, so a later dialect that advertises nothing about its reasoning gets the same rule for
free. The proof is folded in at `resolveReasoningCapability` rather than inside the source chain, because
the chain has several exits and the catalog can return before the observation is ever read.

**Scope corrected after review.** The first build also hid the endpoint-wide Output row behind a third note.
The spec session ruled that back out: the Output row is the strength every Global prompt follows, routed
prompts included, so hiding it costs a prompt pinned to another endpoint its control. The gate is per prompt
only, and the third note is gone. The spec's vLLM decision now says so.

**One real bug the review caught.** The proof only landed if the *first* answering reply was the separated
one. The re-resolve keys on `observationAnswer`, which reads `sawReasoning`, and an inline `<think>` block
and a separate reasoning field both read as true — so after an inline-first reply the key was spent and a
later separated reply never re-resolved. That is exactly what a parser-enabled vLLM produces under Inline
thinking. The key now carries the separation answer, and a reply that first proves separation wakes the
resolve even where `observationMayCorrect` would not, since that guard is about the reasons answer alone.
`SettingsContext.observation.test.tsx` covers it through the real provider, proved red against the bug.

**Two review findings rejected, with evidence.** Both were suggested defensive changes that no test could
distinguish, so shipping them would have been unprovable code:

- *Sticky separation across replies.* Written, then removed: the record's own `mergeReasoningCapability`
  already keeps an answered budget, so an inline reply after a separated one cannot take the slider away.
  The reinstated-bug run passed all eleven tests, which is the proof that the code was doing nothing.
- *A ruled-out guard on the proof.* The contradictory record it guarded is unreachable. A source that rules
  the model out ends the source chain before the model list names the dialect, and an observation carrying
  separated reasoning always answers reasons true. No input produces a vllm record with `reasons: false`
  and a separated reply.

**Live check.** The hosted Default was checked live on 2026-09-15, not inferred. Its models list is the
Aphrodite shape (`owned_by: "aphrodite"`, `max_model_len: 10750`, no reasoning object), and one real turn
came back with `"reasoning": null` and its thinking written into the prose, on Aphrodite 0.21.0. So it
resolves to no per-prompt controls and sends no reasoning field.
