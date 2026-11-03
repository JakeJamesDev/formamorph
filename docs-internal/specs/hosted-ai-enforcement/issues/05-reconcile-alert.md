# 05: Reconcile Failure Alert

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Entitlement freshness, Q4, Q7)

Model rationale: a small counter that follows the balance alert's pattern.

**What to build:** admins get one alert on the third consecutive failed hourly reconcile. The count survives a restart. This ticket owns the split between the hourly run, which counts, and the shared read that ticket 06 reuses, which does not.

- [ ] One or two failed runs send no alert, and the third sends exactly one.
- [ ] Later failures in the same outage send nothing more.
- [ ] A success clears the count, and a later outage alerts again.
- [ ] The count survives a restart.
- [ ] A server without Patreon configured counts nothing.
- [ ] The Patreon reconcile entry in the server glossary states the alert.
