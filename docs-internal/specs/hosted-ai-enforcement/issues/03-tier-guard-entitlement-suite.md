# 03: Tier Guard and Entitlement Suite

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Spend controls, Q10, Q23)

Model rationale: a small guard, and moving existing probes into a permanent suite.

**What to build:** a tier outside the known tiers yields no config before any limit is read, so the limits no longer rest on a database constraint alone. The audit's bypass probes become a permanent entitlement suite.

- [ ] A tier such as `__proto__` reaching the config read gives no config, and the proxy answers `service_paused`.
- [ ] The bypass probes are folded into one named entitlement suite, and the agent probe file is recycled.
- [ ] Removing the guard makes its test fail.
