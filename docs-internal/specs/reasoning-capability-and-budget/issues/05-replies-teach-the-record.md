# 05: Replies Teach The Record

Status: in-progress
Base: 7446144b
Blocked by: 03
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Reasoning Capability and Budget](../spec.md)

**What to build:** A model whose reply carries reasoning is marked as reasoning, and a model that answers bare under a positive effort level is marked as not, so the Native Reasoning controls follow what the player can see happening. The AI Stream is not changed; the settings context records what it already emits.

**Rationale for the model:** a small recorder in the settings context and one more input to the resolver. Sonnet at medium effort.

## Acceptance criteria

- [ ] The settings context records, per endpoint and model, whether the most recent reply carried reasoning and the effort level in force for that call.
- [ ] The resolver takes the observation as an input. Reasoning seen marks reasons yes. No reasoning seen under a positive effort marks reasons no. No reasoning seen under none or Model Default changes nothing.
- [ ] Observation sits after native advertisement and the catalog and before the probe. A native yes or no is never overridden by observation.
- [ ] A change of the observation from unknown to an answer re-resolves the record and the controls update without a reload.
- [ ] Both reasoning shapes count: the separate reasoning field and an inline think block.
- [ ] Tests feed observations to the resolver and cover each rule, plus a context test that a reasoning event from the stream lands in the cache.
- [ ] Typecheck, lint, tests, and build pass; report test wall time; prove the positive-effort rule test fails when the rule is removed. Update the code graph. Changelog In Progress entry, 👤 bucket.

## Scope notes

No change to how reasoning is displayed or saved. The stream's event shape is untouched.
