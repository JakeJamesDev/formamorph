# 08: Hosted State Reports the Turn Limit

Status: ready-for-human
Base: 10fec3d
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Client, Q17)

Model rationale: one additive field beside its neighbors.

**What to build:** the Hosted state carries `turnLimitSeconds`, so the client can expire turn ids in ticket 10.

- [x] A ready account's state holds the configured value. (`hostedAiState.test.js` "returns the tier, window, caps…": `turnLimitSeconds: 600`; daily-paused state too)
- [x] States with no config, such as locked or age gate, hold null. (same file: locked, age-gate and no-model paused tests)
- [x] The Hosted state entry in the server glossary lists the field. (`CONTEXT.md`; README state table row added too, per the spec session)

## Landed

**Not verified:** none.

**For you:** nothing a player can judge.
