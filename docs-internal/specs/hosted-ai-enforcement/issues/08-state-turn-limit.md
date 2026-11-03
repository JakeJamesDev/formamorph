# 08: Hosted State Reports the Turn Limit

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Client, Q17)

Model rationale: one additive field beside its neighbors.

**What to build:** the Hosted state carries `turnLimitSeconds`, so the client can expire turn ids in ticket 10.

- [ ] A ready account's state holds the configured value.
- [ ] States with no config, such as locked or age gate, hold null.
- [ ] The Hosted state entry in the server glossary lists the field.
