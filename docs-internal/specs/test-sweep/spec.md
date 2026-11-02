# Test Sweep

Status: ready-for-agent
Spec session: test-sweep — spec

## Problem Statement

The Vitest suite has 1,712 test files and 31,199 tests. Its code is larger than the code it tests. A full green takes about 9 minutes at the median and about 13 at worst.

The owner cannot tell whether a gate ran the right tests. A green gate may include time and resource waste that only feels good to pass, and it may also miss tests that matter.

The cost is concentrated. `WorldEditor` and `GameViewer` tests take half of the test body time, and `src/lib` takes 4% with half of the files. A typical run also spends about as much worker time on imports, setup and environments as on test bodies. A general sweep could remove many tests and save almost no time.

The suite's history shows the need for evidence. A median commit selects 20% of test files but about 71% of test body time (regex estimate). Line coverage alone cannot judge value, because view mounts touch most library lines by accident.

## Solution

Build one **Test Ledger** from measured evidence. Use it to fix gate selection, move view tests to the right level, cut import cost, and remove what fails an agreed evidence bar.

The work runs in steps, each with a stop gate. The owner can stop after any step and keep its value. Priority order (Q2): the right tests run on a change, then time, then less test code.

"Reference Run" in this spec means the measured starting point. It avoids "baseline", which already names the dirty check's term and the prompt probe command.

## Rulings

| # | Ruling |
|---|---|
| Q1 | Scope is the Vitest suite, gate test selection and full-suite speed setup. |
| Q2 | The right tests run on a change. Time comes second. Less test code comes last. |
| Q3 | The owner picks full-suite and gate time targets after the Reference Run. |
| Q4 | Tickets delete tests when evidence meets the bar. Each ticket lists deletions and reasons. |
| Q5 | Deep-coverage areas: saves, import and migration; turn pipeline and prompts; stat sandbox and scripts; accounts, age gate and moderation. |
| Q6 | CPU-heavy evidence runs wait until the owner says they are AFK. |
| Q7 | Each view keeps a few wiring tests. Panel behavior moves to component tests or merges into them. |
| Q8 | Deletion removes tests one at a time, starting from the slowest. Coverage counts only for the module under test. A test goes when no coverage or behavior is lost and it has no real-bug history. Mutation runs only on Q5 modules that hold deletion candidates. Elsewhere, a read of the test also decides. |
| Q9 | A test tied to a real bug fix goes only if reinstating the bug turns another test red. |
| Q10 | Source-scanning tests become ESLint rules where a rule can express them. Scans of docs, CSS and worlds stay tests. |
| Q11 | Rename guards and parity suites retire once their change is released, except parity that still pins Q5 behavior. |
| Q12 | Every test that goes red for an injected bug must be selected. Injected bugs are source diffs replayed on older tests, plus sampled mutants. Each run also reports precision. |
| Q13 | The full suite keeps running on every push, at close-spec and at release. |
| Q14 | The timeout rerun stays. Each rerun is logged, and repeat offenders get a ticket. |
| Q15 | Speed work can change production imports when behavior is unchanged and gates are green. |
| Q16 | `test-bar` sets the level and risk bar for new tests. A budget warning names slow new tests. |
| Q17 | Features pause only during the view moves and the family sweep. |
| Q18 | Urgent fixes may land during a pause. Affected evidence is refreshed afterward. |
| Q19 | A pause starts after in-flight work lands. |
| Q20 | A pause ends when its step passes its stop gate, or when the owner lifts it. |
| Q21 | Order: Reference Run, selection holes, view mounts, import cost, selection narrowing, scanners and expiry, family sweep, growth rule. |
| Q22 | Weak or mock-only tests are strengthened when they alone cover a behavior, and deleted otherwise. |
| Q23 | Moved or merged tests prove kept protection. Q5 areas keep their mutation kills. Elsewhere, coverage holds and one reinstated bug goes red. |
| Q24 | A time-boxed branch trial of Vitest 5 and Vite 6.4 or later runs before the Reference Run. Adoption needs a measured benefit. |
| Q25 | The Reference Run step fixes repeat CI failures and sends CI through the logged test runner. |
| Q26 | Test seams: the Test Ledger, the affected-test listing scored by a replay harness, the test runner and slow-test reporter, and ESLint rule tests. |
| Q27 | The earlier test-suite-efficiency spec closes as not started. This effort does not carry its findings over or depend on them. |
| Q28 | The trial runs Vitest 5.0.5 on Vite 8.3.5 with plugin-react 6. A Vite 6.4.5 arm runs only if Vite 8 can't run the suite or build inside the time box. |
| Q29 | The trial's time box is one working session plus one AFK window. It fixes config and tooling breaks. Tests still failing go on a list as migration cost. |
| Q30 | Before AFK, the trial runs only the install, a small smoke subset, builds and `--list` reads. All timing and recording runs wait for AFK. Each arm gets three alternating runs. |
| Q31 | The trial recommends adopt only if a full-suite or affected-gate median improves at least 10% and by more than the run spread. A product bug or a build break blocks adopt. Other failures count as migration cost. This bar sets the recommendation, and the owner decides. |
| Q32 | The `recordDependencies` comparison uses three recent landings of different kinds, replayed on the current tree. It reports added and dropped test files against the current selection. |
| Q33 | One module holds the pinned commits, and CI fetches from it. Full clones are rejected for cost. A guard fails if a literal pin returns to CI. New pins elsewhere are caught by a lint rule where one can express it. |
| Q34 | Rerun records are JSONL, one line per retried test, untracked. Local records sit in the git common directory. CI uploads one artifact per shard. |
| Q35 | A run with an unhandled error or a crashed worker never reruns. Only Vitest's own timeout messages and the existing `waitFor` marks can trigger a rerun. |
| Q36 | Repeat offenders that have not failed since the shard change are named with last-seen dates and not fixed. Rerun records watch them from now on. |
| Q37 | The owner adopted Vitest 5 on Vite 8. The Reference Run measures this toolchain and records one affected gate in a fresh ticket worktree, cold then warm, because the trial did not measure that case. |

## User Stories

1. As the owner, I want gates to run the tests a change can break, so that a green gate means something.
2. As the owner, I want a measured reference for full-suite and gate time, so that I can pick real targets.
3. As the owner, I want to stop after any step, so that a partial effort still keeps its value.
4. As the owner, I want heavy runs to wait for my signal, so that they don't take the machine while I work.
5. As the owner, I want features paused only while tests move, so that the sweep doesn't block other work for its whole length.
6. As the owner, I want each deletion listed with its reason, so that I can audit the sweep without approving each test.
7. As the owner, I want deep coverage kept in the Q5 areas, so that data, turn, sandbox and account risks stay guarded.
8. As the owner, I want a measured Vitest 5 decision, so that we don't take a major upgrade on hope.
9. As the owner, I want CI to be reliably green or meaningfully red, so that the full-suite safety net is trusted.
10. As the owner, I want the suite to stay lean after the sweep, so that this effort doesn't need repeating.
11. As a ticket session, I want one ledger of per-test evidence, so that I don't repeat expensive runs.
12. As a ticket session, I want stale evidence marked, so that I never delete a test on old data.
13. As a ticket session, I want a clear delete bar, so that a deletion follows evidence rather than taste.
14. As a ticket session, I want one test removed at a time, so that mutually redundant tests are not both deleted.
15. As a ticket session, I want coverage credited to the module under test, so that accidental view coverage doesn't condemn a fast library test.
16. As a ticket session, I want a proof recipe for moved tests, so that a move can't lose an assertion unnoticed.
17. As a ticket session, I want fast selection for a small change, so that gates stay proportional to the change.
18. As a ticket session, I want a deleted doc or world to fire its path triggers, so that a deletion can't skip the tests it affects.
19. As a ticket session, I want each test family to have one owner during the sweep, so that sessions don't collide.
20. As a test author, I want a level and risk bar in `test-bar`, so that I write the right test the first time.
21. As a test author, I want a warning when my new test is slow, so that I can fix it before it lands.
22. As a test author, I want a lint error instead of a slow source scan, so that I get the same guard at lower cost.
23. As a maintainer, I want panel tests at the panel level, so that a panel change doesn't need a full view mount to verify.
24. As a maintainer, I want each view's wiring tests to remain, so that integration breaks still fail.
25. As a maintainer, I want finished rename guards and parity suites retired, so that gates stop paying for finished migrations.
26. As a maintainer, I want weak assertions strengthened or removed, so that no test passes without proving something.
27. As a maintainer, I want rerun tests logged across local and CI runs, so that flakes stop hiding behind a green rerun.
28. As a maintainer, I want heavy imports deferred or split where behavior allows, so that every test file loads faster.
29. As a maintainer, I want a selection precision number, so that over-selection is visible rather than assumed.
30. As a maintainer, I want misses turned into selection rules, so that the same gap can't return.

## Implementation Decisions

### Steps and stop gates

| Step | Work | Stop gate shows the owner |
|---|---|---|
| 1 | Vitest trial (Q24) | Measured benefit, migration cost, adopt or not |
| 2 | Reference Run, Test Ledger, CI repair (Q25, Q14) | Times, breakdown, failure history; owner sets targets (Q3) |
| 3 | Selection holes | Holes closed and each proved by a test |
| 4 | View mounts (Q7, Q23); features pause | Time saved, wiring tests kept, proof results |
| 5 | Import cost (Q15) | Collection time before and after |
| 6 | Selection narrowing (Q12) | Injected-bug result, its sample size and upper bound, precision |
| 7 | Scanners and expiry (Q10, Q11) | Tests converted or retired, gate time saved |
| 8 | Family sweep (Q8, Q9, Q22); features pause | Deletions, strengthened tests, time saved |
| 9 | Growth rule (Q16) | Rule and warning live; replay rerun on the final tree |

Close-spec compares final numbers against the owner's targets.

### Test Ledger

- One command writes one record per test: identity, median time, its file's import cost, module under test, coverage, failure history, level, and Q5 area.
- Each record carries the test and source hash, so moves and import work show which evidence is stale.
- Raw output is generated and untracked. Each step tracks a short summary in this spec folder.
- Failure history reads CI runs, git history, and session transcripts including worktree ones.
- Coverage uses file-level data per test file. The installed coverage provider has no per-test option. A coverage run starts on a small subset, because a Vitest issue reports hangs on a 255-file run.

### Mutation runs

- Stryker is the candidate tool. The pool must be forks, since threads fail real tests here. Scanner tests are excluded, because they may read instrumented source.
- Runs use incremental mode and start with a one-module smoke test. A Q5 pass may take about 9 hours, which is unverified, so runs cover only modules that hold candidates.

### Test selection

- The existing listing stays the selection seam. Holes get fixed first: deleted files must count toward path triggers.
- The replay harness applies a landing's non-test diff to its pre-landing tests and adds sampled mutants. A replay can need its own install, because the lockfile changed 22 times since Oct 1.
- A narrowing candidate can drop type-only edges, barrel fan-out and mock-factory closures. Any failure a replay misses gets a rule or blocks that narrowing.
- Each result states its sample size and rule-of-three upper bound. The owner decides at the stop gate whether the sample is enough.
- `recordDependencies` applies only if the trial adopts a Vitest version that has it. It skips `fs` reads, so path triggers stay.

### Test runner

- CI runs through the logged runner, and each rerun writes a record the Test Ledger reads.
- The repeat CI failure is `bundledRevisions.test.ts` in 4 of 5 sampled failures. The fix must address its cause, not its trigger.
- The slow-test reporter gains the budget warning. It warns and never fails a gate.

### Pauses and ownership

- A sweep ticket holds one test family. Pauses block feature tickets, not urgent fixes.
- Peers check the family's ticket before they edit one of its tests.

### No shape or version changes

The effort changes no world or save export shape and never changes `APP_VERSION`. Adopting Vitest or Vite changes dev dependencies only, and the Vite major also needs a production build check.

## Testing Decisions

- A test earns trust by failing. `test-bar` applies, including its hard rule against rigging a scenario.
- Removing a test is never a way to go green. A deletion follows Q8 and Q9 only.
- New tooling tests its external behavior: given a change set, which tests are selected; given a run report, which records come out; given a source, which lint result comes out.
- Each selection rule proves itself: remove the rule and a test goes red.
- Each moved test follows Q23. Each deleted bug-fix test follows Q9.
- Modules to test: the Test Ledger, the replay harness, selection rules, rerun logging, the budget warning, and each new ESLint rule.
- Prior art: selection tests, retry tests and reporter tests beside their scripts, and the repo's local ESLint rules.

## Out of Scope

- Playwright e2e and the probe harness tests.
- The earlier test-suite-efficiency spec and its findings (Q27).
- Removing the full suite from CI, close-spec or release (Q13).
- A hard time budget that fails a gate.
- Sharing state across test files by turning isolation off. Earlier runs with it off failed real tests.
- Hook tests under the user's global config.

## Further Notes

- Measured Oct 2026 and Nov 2026, against the tree at those times. The Reference Run replaces all numbers in this spec.
- The 20% and 71% selection figures come from a regex estimate over commits, not from a run.
- The trial's numbers and the adoption checks are in [vitest-trial.md](vitest-trial.md).
