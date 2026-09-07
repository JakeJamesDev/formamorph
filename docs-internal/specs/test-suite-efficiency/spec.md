# Test Suite Efficiency and Trust

Status: ready-for-agent

## Problem

Development loses time to full-suite reruns, unnecessary browser setup, and real-time waits in tests. Some assertions also preserve implementation details or test copies of production logic, creating maintenance work without protecting the claimed behavior.

Improve Vitest feedback speed while preserving regression protection. Playwright auditing and optimization belong to a separate task; they are not included in this implementation.

## Agreed Decisions

| Decision | Agreement |
| --- | --- |
| Completion gate | Keep a full suite before each completed code change. |
| Development loop | Use targeted tests during implementation and failure diagnosis. |
| Performance bar | Demonstrate improvement under comparable conditions; no fixed time ceiling. |
| Quality scope | Repair the identified findings, not an exhaustive review of every assertion. |
| Production changes | Small behavior-preserving changes for testability are allowed. Larger refactors require a separate proposal. |
| Editorial rules | Intentional copy rules remain separate, lightweight blocking checks. |
| Architecture | Shared FullscreenShell reuse remains a requirement. |
| Regression evidence | Preserve meaningful exact-output contracts and demonstrate that replacement tests detect their intended failures. |

## Audit Evidence

The initial audit measured the working tree on September 7, 2026. Other work was already changing that tree, so establish a fresh baseline before implementation rather than treating these numbers as a fixed benchmark.

| Run | Wall time | Result |
| --- | ---: | --- |
| Full Vitest suite | 58.50s | 515 files; 8,451 passed, 6 failed, 3 skipped |
| Turn-pipeline folder | 2.22s | 12 files; 274 passed |
| Changelog file outside the sandbox | 1.73s | 14 passed |

Three full-run failures were child-process permission errors; the isolated approved rerun passed. Two site-boundary assertions and an age-gate request assertion also failed in the working tree. Recheck their current status and coordinate with their owners; unrelated fixes are not part of this effort.

Vitest reported cumulative worker times of 585.86s for environments, 169.71s for setup, and 358.49s for tests. These overlap across workers and must not be presented as wall-clock durations or additive savings. The run did not establish a leaked-handle shutdown delay.

The suite contained 515 test files, only five with explicit Node environments, and no snapshot matcher calls. This supports targeted repairs, not wholesale removal of exact comparisons.

## Execution Organization

### Separate environments and responsibilities

- Separate pure Node tests from DOM/component tests. Classify by actual runtime dependencies, not `.ts` versus `.tsx`: hooks, storage, and browser APIs can appear in either.
- Give Node tests minimal setup. Scope React cleanup, browser shims, and application cache resets to the tests that require them.
- Preserve per-file isolation and required cross-test cleanup. Do not gain speed by permitting state leakage or dropping meaningful integration coverage.
- Keep architectural and editorial checks independently runnable, lightweight, and included in the aggregate completion gate.
- Preserve existing Electron and harness test discovery, including intentional opt-in live-model cases. Environment grouping must not activate network-dependent probes.
- Keep the normal aggregate test command running every required Vitest group exactly once. Environment selection must not silently exclude files.

### Make targeted execution dependable

Provide documented ways to list and run a file, a domain, and tests affected by production changes. Start with existing Vitest capabilities and small explicit mappings; avoid building a separate general-purpose dependency system.

Selection must account for callers and integration tests, not just a neighboring test filename. Source-reading checks, fixtures, styles, and other filesystem dependencies need explicit mappings or inclusion in an appropriate structural group. Broad configuration/setup changes and uncertain dependency coverage fall back to the full suite.

The audit's dependency query for `devRouter.ts` selected 71 files but omitted `devRouter.test.ts`, which copied the parser. Repaired tests must depend on real production entry points. An empty selection is not successful verification of a changed behavior.

Document these workflow rules:

1. Run targeted checks while implementing and diagnosing failures.
2. Complete the applicable typecheck, lint, full test, and build gates against the final code and tests before marking a code change complete.
3. After a failure, rerun the relevant check rather than automatically restarting every gate. A later behavior change requires a final full test run again.
4. Reporting, unrelated documentation edits, and reading results do not invalidate an otherwise current test result. Configuration, fixtures, and files read by structural checks can invalidate it.
5. Capture output, timing, and exit status from one run. Do not rerun a suite just to obtain its totals.

Keep the workflow in maintained developer documentation and command entry points. Do not edit user-managed instruction files as an incidental part of implementation.

## Runtime Improvements

The initial full run measured 19.17s of test execution in `src/lib/imageGen/invokeai.test.ts`. Mock responses commonly transition from `in_progress` to `completed` through the production 700ms polling interval. Error-recovery tests traverse multiple intervals.

Use a controlled clock to exercise pending work, repeated failures, recovery, completion, and aborts without waiting in real time. Preserve the same triggering conditions and verify request counts, intermediate states, and outcomes. Do not replace pending responses with immediate success or lower production polling intervals to satisfy tests.

Profile the identified expensive UI suites before changing their harnesses: MainMenu age gate, EventFormDialog, WorldEditor bench/image conversion, and CodeArea. Reduce repeated setup or incidental waits where evidence supports it, while retaining real user interaction and provider wiring where those are the contract. Broad component extraction remains a separate proposal.

## Identified Quality Repairs

| Finding | Required outcome |
| --- | --- |
| [Dev-router tests](../../../src/lib/devRouter.test.ts) define their own parser | Exercise the actual parser/router entry point. Retain the unrelated route-coverage checks. |
| Dictionary restoration cases in [save compatibility tests](../../../src/lib/saveCompat.test.ts) test a local predicate | Exercise real loading/restoration. Verify legacy saves without the field preserve the intended runtime dictionaries and saves carrying dictionaries restore them. Retain the surrounding migration tests. |
| [World-search label tests](../../../src/lib/worldSearchLabels.test.ts) find captions anywhere in manager source | Verify that actual search targets correspond to the correct rendered fields, including identical field text where a caption must disambiguate. |
| [FullscreenShell tests](../../../src/components/FullscreenShell.test.tsx) pin incidental source names | Preserve shared-shell reuse as an architectural check that tolerates equivalent syntax. Verify user-visible fullscreen requirements separately. An unused import is not evidence of reuse. |
| [Viewport sizing](../../../src/lib/viewportSizing.test.ts) and [changelog typography](../../../src/components/menu/WebVersionChangelog.test.tsx) checks use source regexes | Retain intentional sizing/theme/font-role contracts; replace incidental spelling constraints where practical. Do not claim browser layout has been verified by source text or jsdom. Browser-level follow-up belongs to the Playwright task. |
| [Settings copy tests](../../../src/components/modals/settingsCopy.test.ts) equate word count with one-line fit | Keep intentional title-case, sentence, and length rules as editorial checks, accurately named. Do not represent those rules as layout evidence. |
| [Site boundary tests](../../../site/bundleBoundary.test.ts) rely on restricted source matching and require style scanning for behavior-only modules | Protect the actual bundle boundary and style-bearing dependencies. Account for relevant import forms; pure utilities need not be in the stylesheet scan solely because they are reachable. Preserve intentional lazy loading. |

Before replacing an assertion, identify its actual contract and its replacement evidence. Preserve byte-exact file integrity, serialization contracts, and recorded turn-pipeline parity where bytes are meaningful. Do not regenerate parity fixtures merely to make failures disappear.

Use the existing test-quality bar: measure coverage for production modules changed for testability, and temporarily reintroduce each repaired failure to confirm that the intended test goes red. Restore production code and verify restoration. Replacement tests must call production code rather than reproduce its decision logic.

## Measurement and Acceptance

- Record the revision, relevant working-tree changes, runtime, worker settings, cache conditions, and competing work for before/after measurements. Use comparable conditions; distinguish a harness improvement from different machine load.
- Measure the full suite and fixed representative targeted selections: pure logic, turn pipeline, DOM integration, structural/editorial checks, and InvokeAI polling. Compare the same behavioral cases before and after regrouping.
- Report wall time, runner phases, slow files, assertion counts, skips, failures, and process exit status. Explain intentional changes in test counts with the old contract and replacement evidence.
- Demonstrate improvement in full-suite and representative targeted feedback. No specific percentage or absolute limit is promised. Repeat measurements only when needed to distinguish improvement from noise; benchmark repetitions are separate from routine gate reruns.
- Preserve discovery of all existing required tests and retain intentional skips with their reasons. Prove targeted selection includes affected callers and mapped filesystem dependencies, and that uncertainty triggers full coverage.
- All required completion gates must pass on the final implementation. A passing summary with a nonzero exit status is a failure. Do not mask unrelated failures, permission errors, or unhandled rejections.
- Do not disable isolation, force process exit, weaken scenarios, silently drop checks, or add blanket mocks of the behavior under test for speed.

## Implementation Sequence

1. Establish the current inventory, comparable baseline, and test-selection contracts. Coordinate around concurrent edits.
2. Separate environments and scoped setup; expose and document targeted and aggregate commands.
3. Replace real-time polling waits and address measured UI harness overhead within the permitted scope.
4. Repair the identified assertions and organize editorial/architectural checks; prove the replacement guards.
5. Measure the final result, review discovery and selection coverage, and complete the code-change gates and developer-tooling documentation.

Each complete implementation slice retains its full-suite completion gate. Keep benchmark comparisons tied to an identified tree; do not combine results from moving concurrent changes as if they were one revision.

## Boundaries

Playwright profiling, browser-server grouping, device coverage, and browser assertion repairs belong to the separate Playwright audit. Coordinate any shared command/configuration changes before editing overlapping files.

No prompt wording changes, world/save export-shape changes, version bump, package upgrade, or broad production refactor is required. Newly discovered adjacent problems are reported for a separate decision.

Graphify's read-only query succeeded through approved execution after sandboxed execution returned access denied. Use that supported route and existing local launcher guidance; reinstalling Graphify or widening machine permissions is not part of this spec.
