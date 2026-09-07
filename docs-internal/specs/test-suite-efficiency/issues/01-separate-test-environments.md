# 01: Separate Node and DOM Test Execution

Status: ready-for-agent

**Parent:** [Test Suite Efficiency and Trust](../spec.md)

**Blocked by:** None (can start immediately).

## What to Build

Pure tests run without browser and React setup, while DOM tests retain the environment and cleanup they need. The normal aggregate command still runs every required Vitest test exactly once.

Establish a fresh, reproducible baseline before changing execution. Classify tests by real runtime dependencies, not filename extensions. Introduce the necessary runner separation without weakening isolation or changing production behavior.

## Acceptance Criteria

- [ ] Record the baseline tree, relevant local changes, runtime, worker settings, cache conditions, and competing work. Capture full-suite and representative targeted timings, exit status, discovery, counts, skips, and failures.
- [ ] Pure Node tests have minimal setup; browser shims and React cleanup apply only where needed. Application-specific cache resets remain effective without loading unrelated application dependencies into pure suites.
- [ ] DOM-dependent hooks, storage tests, and other browser consumers retain appropriate environments regardless of filename extension.
- [ ] Independently runnable groups and the aggregate command preserve every required test without duplicate discovery. Include existing Electron and harness tests while preserving intentional live-model opt-ins and skips.
- [ ] Per-file isolation and meaningful cross-test cleanup remain enabled. Demonstrate that representative suites remain independent when run alone and together.
- [ ] Compare the same pure-logic, turn-pipeline, and DOM selections before and after; report setup and environment costs separately from wall time.
- [ ] Document group usage and the aggregate command. Avoid package upgrades and user-managed instruction edits.
- [ ] Complete typecheck, lint, the full test suite, and build; report test wall time and process exit status. Update developer-tooling changelog documentation and the code graph as applicable.

## Coordination

Own runner grouping, shared setup, and their command definitions. Coordinate shared configuration with the separate Playwright task and other tickets; do not change browser execution here. Benchmark a fixed tree rather than attributing concurrent edits to this ticket.

Unexpected existing failures must be surfaced and coordinated with their owners, not skipped or silently repaired as adjacent work.
