# 02: Control the InvokeAI Test Clock

Status: ready-for-agent

**Parent:** [Test Suite Efficiency and Trust](../spec.md)

**Blocked by:** None (can start immediately).

## What to Build

InvokeAI tests exercise the production polling lifecycle without waiting through real polling intervals. Pending work, transient errors, persistent failure, completion, and cancellation retain their existing meaning.

Use a controlled clock around real provider behavior. Do not lower production intervals, substitute immediate-success responses, or remove conditions that cause polling.

## Acceptance Criteria

- [ ] Capture a targeted baseline before editing and compare the same behavioral cases afterward under comparable runner and machine conditions.
- [ ] Tests advance the clock through pending states and observe the expected request sequence, counts, intermediate progress, and final result.
- [ ] Transient errors still require recovery; persistent errors still terminate at the intended boundary. Neither scenario becomes an immediate-success fixture.
- [ ] Cancellation while waiting or making a request reaches the real abort path, stops further work, and leaves no pending timers or listeners owned by the test.
- [ ] Restore real timers and globals between tests; preserve isolation when the suite runs with other provider tests.
- [ ] Temporarily break the guarded polling/recovery/cancellation decisions and confirm the expected tests fail for the intended reason. Restore and verify production code afterward.
- [ ] Report targeted wall-time improvement and any remaining real-time waits with their purpose. A faster passing summary alone is insufficient if the process exits nonzero.
- [ ] Complete typecheck, lint, the full test suite, and build; report test wall time and exit status. Update the developer-tooling changelog and code graph as applicable.

## Coordination

This ticket does not depend on environment regrouping. If runner configuration changes during measurement, reestablish comparable conditions rather than combining incompatible results. Keep any production change small and behavior-preserving; larger refactors require a separate proposal.
