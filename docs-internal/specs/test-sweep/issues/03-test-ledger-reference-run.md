# 03: Test Ledger And Reference Run

Status: ready-for-agent
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

- [ ] The ledger command writes one record per test, and tests cover its output from a given run report.
- [ ] Changing a test or its source marks that record stale; a test proves it.
- [ ] A Reference Run summary records wall time, the vitest breakdown, the top families, and failure history.
- [ ] The summary names which tests have real-bug history and how that was determined.
- [ ] The owner's full-suite and gate targets (Q3) are recorded in the summary.

For you: Pick full-suite and gate time targets from the Reference Run summary.
