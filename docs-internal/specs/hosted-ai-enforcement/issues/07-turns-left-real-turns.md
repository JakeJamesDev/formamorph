# 07: Turns Left Counts Real Turns

Status: done
Base: 2946224
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Turns-left correctness, Q16, Q19)

Model rationale: one query change with direct tests.

**What to build:** a Supporter's turns-left figure averages only turns that hold a narration call, so background and very cheap turns do not make it read too high.

- [x] Turns with no narration call do not change the average. (`averages only turns that hold a narration call, summing all their calls`)
- [x] With too few narration turns, the tier's fallback cost applies as it does today. (`falls back to the tier figure when only non-narration turns exist`, including NULL types)
- [x] A turn with a call still open stays out of the sample. (`leaves out a turn that still has a call open`, plus a mixed turn with an open non-narration call)
- [x] Removing the filter makes a test fail. (Removed it: both new tests went red; restored and grep-checked.)

## Landed

**Not verified**: none.

**For you**: none.

Spec rulings (Q16/Q19 follow-up): a kept turn's cost sums all its calls; any open call of any type drops the turn; NULL or unknown prompt types are not narration.
