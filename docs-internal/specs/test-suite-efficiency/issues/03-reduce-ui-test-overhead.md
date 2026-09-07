# 03: Reduce Measured UI Test Overhead

Status: ready-for-agent

**Parent:** [Test Suite Efficiency and Trust](../spec.md)

**Blocked by:** [01: Separate Node and DOM Test Execution](01-separate-test-environments.md).

## What to Build

The identified expensive UI suites provide the same user-facing regression protection with less avoidable harness overhead. Profile MainMenu age gate, EventFormDialog, WorldEditor bench/image conversion, and CodeArea after environment separation so optimization targets remaining costs.

Reduce redundant setup and incidental waits where measurements justify it. Retain actual interaction, controlled component ownership, and provider wiring when those are what a test promises to verify.

## Acceptance Criteria

- [ ] Capture per-suite and relevant per-test timings after ticket 01; distinguish rendering, interaction, intentional timing, and setup costs before selecting changes.
- [ ] Address confirmed overhead with bounded harness changes. Record which identified suites changed and which were left alone, with evidence-based reasons.
- [ ] CodeArea typing, caret, completion, history, and parent-value contracts remain covered. Advancing time must preserve debounce and interaction boundaries rather than disabling them.
- [ ] MainMenu and WorldEditor integration scenarios still exercise the real state/provider relationships and user decisions they claim to guard.
- [ ] Do not replace meaningful user flows with blanket component mocks, remove load or timing triggers, or weaken assertions to obtain speed.
- [ ] Demonstrate each changed guard detects its intended regression; measure coverage on any production module changed for testability and verify restoration after temporary mutations.
- [ ] Report comparable before/after timings and retained scenarios. Use additional measurements only where needed to resolve noise.
- [ ] Complete typecheck, lint, the full test suite, and build; report test wall time and exit status. Update the developer-tooling changelog and code graph as applicable.

## Coordination

Larger component extraction or shared state redesign is a separate proposal, not an implicit part of this ticket. If profiling leaves no justified small optimization, record the evidence and bring the scope decision back instead of manufacturing a change or declaring the performance requirement met.

Coordinate provider and harness edits with the save-restoration and search-target tickets. Shared-file conflicts require sequencing even when there is no logical blocking edge.
