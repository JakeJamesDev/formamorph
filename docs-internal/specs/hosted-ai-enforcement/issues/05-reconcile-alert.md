# 05: Reconcile Failure Alert

Status: done
Base: 2946224
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Repo: FormamorphServer
Spec: `docs-internal/specs/hosted-ai-enforcement/spec.md` in formamorph (Entitlement freshness, Q4, Q7)

Model rationale: a small counter that follows the balance alert's pattern.

**What to build:** admins get one alert on the third consecutive failed hourly reconcile. The count survives a restart. This ticket owns the split between the hourly run, which counts, and the shared read that ticket 06 reuses, which does not.

- [x] One or two failed runs send no alert, and the third sends exactly one. (test "sends no alert for one or two failed runs…")
- [x] Later failures in the same outage send nothing more. (test "sends nothing more for later failures…"; mutation `<` fails it)
- [x] A success clears the count, and a later outage alerts again. (test "clears the count on a success…"; removing the reset fails it)
- [x] The count survives a restart. (test "keeps the count across a restart", reloads the module over the same database)
- [x] A server without Patreon configured counts nothing. (test "counts nothing on a server without Patreon configured")
- [x] The Patreon reconcile entry in the server glossary states the alert. (`CONTEXT.md`)

## Landed

**Not verified:** none. The real mail send is covered only by the existing `alertAdmins` tests.

**For you:** nothing a player can judge. Shared read for ticket 06: `refreshLinksFromMembers()` in `src/utils/reconcilePatreon.js`.
