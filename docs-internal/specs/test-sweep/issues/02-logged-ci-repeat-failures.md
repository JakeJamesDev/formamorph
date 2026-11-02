# 02: Logged CI And Repeat Failures

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: A contained runner and CI change, plus a root-cause diagnosis of one repeat failure.

Parent: [Test Sweep spec](../spec.md)

## What to build

CI becomes a trustworthy safety net (Q13, Q25). CI runs tests through the logged runner, and every timeout rerun writes a record that later tools can read, locally and in CI (Q14). The repeat CI failure gets fixed at its cause. `bundledRevisions.test.ts` was 4 of 5 sampled failures, and 41 of the last 300 CI runs failed. Classify the remaining failures in those 300 runs, so any other repeat offender is fixed here or named for the owner.

A rerun stays allowed. It must leave a record, and it must not change a real failure into a pass.

Rulings: Q13, Q14, Q25.

## Acceptance criteria

- [x] CI's test job runs through the logged runner, and its shards still cover every test file. `ciWorkflow.test.mjs`; vitest's sequencer on the real tree: 1720 files, 430 per shard, none missing, none in two shards.
- [x] A forced timeout writes a rerun record naming the test, the file and the result; a test proves it. `runTests.test.mjs`, "reruns a forced timeout alone".
- [x] A real failure never retries; a test proves it. `runTests.test.mjs`, "never retries a real failure"; reinstating the retry turned it red.
- [x] The repeat failure has its cause fixed, and reinstating the cause turns the test red. A literal sha line in `ci.yml` turned `ciWorkflow.test.mjs` red.
- [x] A short list classifies the failures in the last 300 CI runs. [ci-failures.md](../ci-failures.md).

## Landed

**Not verified**

- A real CI run. `fetchPinnedCommits.mjs` on a shallow clone, the sharded runner and the artifact upload first run on the next push. The script keeps the fetch arguments the old line used.

**For you**

- After the next push, open the CI run's artifacts. Each of the 4 shards should show `test-reruns-shard-N`, and an empty file means no rerun.

**Notes**

- **Retention:** 90 days, measured from release artifacts (created 10-29, expiring 01-27). The settings API refuses this token.
- **Q35 (a):** proved by run. With the outcome gate off, a timeout plus an unhandled error reran and came back green, so JUnit does not carry unhandled errors.
- **Crash path:** a killed worker stays red with no rerun, and a test proves it. The outcome gate does not hold this case: that test stays green with the gate off, so something other than the gate stops the rerun. What stops it is unconfirmed.
- **Lint rule:** `formamorph/no-pinned-commit` found no other 40-digit hash in linted files. ESLint ignores `electron/`, so the rule does not cover it.
- **Local rerun cost:** a timeout that comes with an unhandled error now stays red, where it used to rerun. A starved run that leaks an error after a timeout will show this.
- **Hook timeouts:** a failed hook's record names its suite (`file > group`), which is not a key the slow-test reporter writes. Ticket 03 reads it as a suite.
- **Not fixed (Q36):** the old repeat offenders. `outputRun.pacer.test.ts` failed after the shard change, last on 10-17, with 46 clean runs since, and `ci-failures.md` names it. The doc and changelog breaks came from contributor branches, so ticket 04 gets no selection hole from them.
