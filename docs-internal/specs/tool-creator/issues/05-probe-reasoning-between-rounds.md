# 05: Probe Reasoning Kept Between Tool Rounds

Status: ready-for-human
Base: 5f80e245
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## Parent

[Tool Creator](docs-internal/specs/tool-creator/spec.md)

## What to build

An answer to the open question in the spec's Further Notes: when the assistant message between tool rounds carries the model's own reasoning, does LM Studio accept it, and does the loop still complete on MeroMero? The prefill-order findings show the thought channel is fragile there, so this must be measured, not assumed.

Use the existing tool-call probe harness with the selection fixture and the saved retrieve-first description. Run two arms: control (content and calls only between rounds) and kept-reasoning (the model's reasoning field echoed on the assistant message). Score completion, involved coverage and unneeded lookups on both seeds. Write a findings file next to the other probe findings and fold the ruling into the spec: keep reasoning, or ship without it. No app code changes.

Model rationale: Fable at high effort for experimental design, transport-level debugging of LM Studio's message handling and a ruling that shapes the request-layer ticket.

## Acceptance criteria

- [x] Both arms run on MeroMero via LM Studio with the standard two seeds and the six selection cases.
- [x] The findings file records the request shape used for the kept-reasoning arm, completion per trial and the involved-coverage score under the involved-entity rule.
- [x] Any LM Studio rejection or silent drop of the reasoning field is captured verbatim.
- [x] The spec's Further Notes entry is replaced by the ruling, and the request-layer decision is reworded to match.
- [x] No production code changes.
