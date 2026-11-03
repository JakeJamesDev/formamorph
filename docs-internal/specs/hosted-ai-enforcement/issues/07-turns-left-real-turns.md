# 07: Turns Left Counts Real Turns

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Turns-left correctness, Q16, Q19)

Model rationale: one query change with direct tests.

**What to build:** a Supporter's turns-left figure averages only turns that hold a narration call, so background and very cheap turns do not make it read too high.

- [ ] Turns with no narration call do not change the average.
- [ ] With too few narration turns, the tier's fallback cost applies as it does today.
- [ ] A turn with a call still open stays out of the sample.
- [ ] Removing the filter makes a test fail.
