# 05: Test Real Save Dictionary Restoration

Status: ready-for-agent

**Parent:** [Test Suite Efficiency and Trust](../spec.md)

**Blocked by:** None (can start immediately).

## What to Build

Regression tests load saves through the real restoration path and observe runtime dictionaries. Replace the test-local restoration predicate, which currently proves nothing about the loader.

Test legacy absence and explicit saved dictionaries against distinguishable existing runtime state. Keep authored world data immutable during gameplay and preserve the surrounding migration coverage.

## Acceptance Criteria

- [ ] Load a legacy save without dictionaries through production behavior and verify that the intended existing runtime dictionaries are preserved.
- [ ] Load a save carrying distinct dictionaries and verify those dictionaries become the runtime state, rather than merely asserting that the input contains them.
- [ ] Exercise an explicit empty saved array and distinguish clearing dictionaries from the legacy absent-field behavior.
- [ ] Assertions observe the consumer-visible runtime result. No local predicate, copied loader branch, or mocked restoration decision substitutes for production loading.
- [ ] Existing migration and save-envelope contracts remain covered, and authored world data is not mutated by the tests' gameplay flow.
- [ ] Remove the superseded local-predicate assertions only after replacement guards are demonstrated. Temporarily break preservation/restoration decisions and confirm the expected tests fail; restore and verify the source afterward.
- [ ] Measure coverage on any production module changed for testability. No save/world export-shape change or shipped-save migration is authorized by this ticket.
- [ ] Complete typecheck, lint, the full test suite, and build; report test wall time and exit status. Update the developer-tooling changelog and code graph as applicable.

## Coordination

Use a bounded harness or small production testability change; a broad gameplay-provider refactor requires a proposal. Coordinate shared provider/harness edits with ticket 03 and retain per-test state cleanup.
