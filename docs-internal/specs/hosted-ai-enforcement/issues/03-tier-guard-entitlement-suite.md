# 03: Tier Guard and Entitlement Suite

Status: done
Base: 6a1f462
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Spend controls, Q10, Q23)

Model rationale: a small guard, and moving existing probes into a permanent suite.

**What to build:** a tier outside the known tiers yields no config before any limit is read, so the limits no longer rest on a database constraint alone. The audit's bypass probes become a permanent entitlement suite.

- [x] A tier such as `__proto__` reaching the config read gives no config, and the proxy answers `service_paused`. (`gets no config and a paused service when a tier outside the known tiers reaches the read`; calls `proxy` with a fake request, because `entitlement` already drops unknown tiers)
- [x] The bypass probes are folded into one named entitlement suite (`tests/hostedAiEntitlement.test.js`), and the agent probe file is recycled. (recycle follows the landing, per the brief)
- [x] Removing the guard makes its test fail. (removed both checks: `expected {…} to be null`)

## Landed

**Not verified**
- None.

**For you**
- Spec ruled three probes out of the suite, because each pinned a gap that other tickets close: a turn kept past the weekly budget (ticket 01), a turn kept through a pause (ticket 02), a stale link that keeps its tier when the member list read fails (ticket 04). Those tickets need their own tests.
