# 03: Test Ledger And Reference Run

Status: ready-for-human
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: New tooling that every later ticket reads; its record shape and hash rule must hold for the whole effort.

Parent: [Test Sweep spec](../spec.md)

## What to build

One command writes the Test Ledger, and its first full result is the Reference Run. Each record holds identity, median time, its file's import cost, module under test, file-level coverage, failure history, level, Q5 area, and the test and source hash. Failure history reads CI, git, rerun records, and session transcripts including worktree ones. A record whose hash no longer matches reads as stale.

Run coverage on a small subset first, because a Vitest issue reports hangs on a 255-file run. Heavy runs wait until the owner says they are AFK (Q6). Raw output is untracked; a short summary lands in the spec folder.

Rulings: Q1, Q3, Q5, Q6, Q8, Q26.

## Acceptance criteria

- [x] The ledger command writes one record per test, and tests cover its output from a given run report.
- [x] Changing a test or its source marks that record stale; a test proves it.
- [x] A Reference Run summary records wall time, the vitest breakdown, the top families, and failure history.
- [x] The summary names which tests have real-bug history and how that was determined.
- [x] The owner's full-suite and gate targets (Q3) are recorded in the summary.

## Landed

[reference-run.md](../reference-run.md) holds the results and the owner's targets: 240 s full suite, 200 s gate on the 610-file sample. [testLedger.mjs](../../../../scripts/testLedger.mjs) writes the ledger to `<git common dir>/test-ledger`.

**Not verified:**

- The coverage process and the `TestLedgerReporter` class have no unit test. Only the smoke run and the Reference Run exercised them.
- Peer gates overlapped two of the three full runs and both gate runs. The summary records this.
- The real-bug tests are named per file in the summary. The per-test list comes from `--real-bug`, because it is too long to track.
- Rule (b) missed 15 failed CI runs whose logs are gone.

For you: nothing. You picked the targets on 2026-11-02.
