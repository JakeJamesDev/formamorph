# 09: Deliver Dependable Targeted Commands and Performance Evidence

Status: ready-for-agent

**Parent:** [Test Suite Efficiency and Trust](../spec.md)

**Blocked by:**

- [01: Separate Node and DOM Test Execution](01-separate-test-environments.md)
- [02: Control the InvokeAI Test Clock](02-control-invokeai-test-clock.md)
- [03: Reduce Measured UI Test Overhead](03-reduce-ui-test-overhead.md)
- [04: Test the Real Dev Router](04-test-real-dev-router.md)
- [05: Test Real Save Dictionary Restoration](05-test-save-dictionary-restoration.md)
- [06: Verify Search Targets Against Rendered Fields](06-verify-search-field-targets.md)
- [07: Make Editor Architecture and Editorial Checks Meaningful](07-strengthen-editor-contract-checks.md)
- [08: Verify Site Bundle and Stylesheet Boundaries](08-verify-site-boundaries.md)

## What to Build

Developers and agents can list and run tests for a file, a domain, or affected behavior using the completed test groups and dependency relationships. Uncertain selection falls back to the full suite. The final performance report demonstrates the agreed improvements without weakening the completion gate.

Build on existing Vitest selection capabilities and small explicit mappings. Do not introduce a separate general-purpose dependency system. This ticket integrates already-green slices rather than deferring their correctness checks until the end.

## Acceptance Criteria

- [ ] Provide documented, runnable entry points for listing and executing file, domain, affected, structural/editorial, and aggregate selections.
- [ ] Affected selection includes production callers and integration tests, not only neighboring test files. The real router regression tests are selected for relevant router changes.
- [ ] Map source-reading checks, fixtures, styles, and other filesystem dependencies explicitly or include the appropriate structural group. Verify both ordinary imports and representative mapped dependencies.
- [ ] Broad runner/setup changes and uncertain dependency coverage fall back to the full suite. An empty affected selection is not accepted as verification of changed behavior.
- [ ] The normal aggregate command discovers every required test exactly once and preserves intentional opt-in cases and skips. Explain all test-count changes through retained or replacement contracts.
- [ ] Document targeted checks during development and failure diagnosis, followed by the final full completion gate. A later behavior change requires a final full run; unrelated reporting/documentation does not invalidate a current result, while files consumed by checks can.
- [ ] Capture timing, output, counts, skips, failures, and exit status from one run per check. Never rerun a suite merely to collect its totals or hide unhandled errors behind a passing summary.
- [ ] Compare full-suite and fixed representative targeted results against comparable pre-change behavior: pure logic, turn pipeline, DOM integration, structural/editorial checks, and InvokeAI polling. Identify tree, runtime, workers, cache state, and competing work.
- [ ] Demonstrate measured improvement in aggregate and representative targeted feedback without an invented percentage or time ceiling. Do not add parallel worker phase times as wall-time savings. Resolve measurement noise explicitly where necessary.
- [ ] Summarize replacement-guard mutation evidence and coverage for production modules changed for testability, including limitations and browser evidence owned by the Playwright task.
- [ ] Complete typecheck, lint, the full test suite, and build against the final implementation; report wall time and actual exit status. Update developer documentation, the developer-tooling changelog, and the code graph as applicable.

## Coordination

Keep Playwright execution and server grouping separate, coordinating only shared command/configuration surfaces. Do not modify user-managed instruction files, Graphify installation, package versions, product prompts, or world/save shapes.

If the agreed performance improvement is not demonstrated, report the remaining bottleneck and bring any larger change back as a proposal. Do not close the effort by reducing coverage, disabling isolation, forcing process exit, or silently changing the acceptance bar.
