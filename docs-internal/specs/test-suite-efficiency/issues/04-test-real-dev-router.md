# 04: Test the Real Dev Router

Status: ready-for-agent

**Parent:** [Test Suite Efficiency and Trust](../spec.md)

**Blocked by:** None (can start immediately).

## What to Build

Dev-router parsing and navigation tests exercise the production implementation instead of a test-local parser. A change to route handling becomes visible to regression tests and dependency-based test selection.

Use the existing entry points or a small behavior-preserving testability change. Keep unrelated route-coverage checks and the production exclusion of development-only routing.

## Acceptance Criteria

- [ ] Replace the copied-parser cases with calls through actual production routing/parsing behavior; remove the duplicate decision logic once its replacement is proven.
- [ ] Cover non-dev hashes, bare dev routes, absent fields, and the currently supported route fields, including fields that the old copy omitted.
- [ ] Verify navigation encoding and route decoding agree through real entry points where practical, including encoded values and hash updates.
- [ ] Existing route, modal, tab, and fixture coverage contracts remain protected. Development-only behavior remains excluded from production.
- [ ] A dependency-selection check for a router change includes the replacement regression tests, not merely unrelated consumers.
- [ ] Temporarily break actual route decisions or field propagation; confirm the appropriate tests fail, then restore and verify production code.
- [ ] Measure coverage for any production module changed for testability. Report what the tests do and do not establish without claiming browser layout coverage.
- [ ] Complete typecheck, lint, the full test suite, and build; report test wall time and exit status. Update the developer-tooling changelog and code graph as applicable.

## Coordination

Preserve existing route behavior and interfaces for concurrent UI work. Do not redesign routing or add new navigation features. Provide the final production-to-test dependency evidence to ticket 09.
