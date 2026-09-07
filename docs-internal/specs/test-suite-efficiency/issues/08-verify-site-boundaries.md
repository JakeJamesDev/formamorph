# 08: Verify Site Bundle and Stylesheet Boundaries

Status: ready-for-agent

**Parent:** [Test Suite Efficiency and Trust](../spec.md)

**Blocked by:** None (can start immediately).

## What to Build

Site boundary checks detect forbidden game dependencies and missing stylesheet coverage for components that need it. Behavior-only utilities do not require stylesheet scanning merely because the site can reach them.

Preserve intentional lazy loading and dependency boundaries while replacing restricted source matching with evidence suited to the contract. Do not make failures disappear by widening allowlists without examining the reachable dependencies.

## Acceptance Criteria

- [ ] Check relevant reachable dependency paths, including supported relative/aliased imports and re-exports, rather than recognizing only one spelling of imports.
- [ ] Distinguish runtime dependencies from type-only relationships when asserting runtime bundle isolation; preserve the intended entry/lazy-route boundary.
- [ ] A reachable style-bearing component omitted from stylesheet coverage fails, while a reachable utility without styles is not required solely by reachability.
- [ ] Bypassing the intended lazy route boundary or introducing a forbidden transitive dependency triggers the appropriate check.
- [ ] Test names state whether they verify source architecture, stylesheet inputs, or actual build output. Module counts and regex matches are not presented as measured bundle size.
- [ ] Prove the repaired checks reject their intended violations and accept equivalent allowed import forms. Restore and verify temporary mutations.
- [ ] Keep the checks independently selectable and included in the full gate. Provide the source/configuration/filesystem dependency mappings needed by ticket 09.
- [ ] Preserve production site behavior, allowed sharing, and lazy loading. Browser tests and unrelated community feature repairs are outside this ticket.
- [ ] Complete typecheck, lint, the full test suite, and build; report test wall time and exit status. Update the developer-tooling changelog and code graph as applicable.

## Coordination

Concurrent community work may change the allowed dependency graph. Establish the current intended boundary from that work and the parent spec; do not freeze a transient audit failure as the expected product architecture. Coordinate shared runner/build configuration with ticket 01 and the Playwright task.
