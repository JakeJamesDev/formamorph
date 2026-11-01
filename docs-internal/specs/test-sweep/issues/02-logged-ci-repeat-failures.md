# 02: Logged CI And Repeat Failures

Status: ready-for-agent
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

- [ ] CI's test job runs through the logged runner, and its shards still cover every test file.
- [ ] A forced timeout writes a rerun record naming the test, the file and the result; a test proves it.
- [ ] A real failure never retries; a test proves it.
- [ ] The repeat failure has its cause fixed, and reinstating the cause turns the test red.
- [ ] A short list classifies the failures in the last 300 CI runs.
