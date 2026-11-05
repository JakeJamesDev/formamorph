# 06: Selection Replay Harness

Status: ready-for-human
Blocked by: 04, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: Sound scoring design is the hard part; a weak harness would falsely approve narrowing.

Parent: [Test Sweep spec](../spec.md)

## What to build

A harness scores selection with injected bugs (Q12). It applies a landing's non-test diff to the tests from before that landing, adds sampled mutants, and requires every red test to be selected. It also reports precision, its sample size and rule-of-three upper bound. A replay can use its own install, because the lockfile changed often.

The ticket scores today's selection and records the result as the starting number. Heavy runs wait for the owner's AFK signal (Q6).

Rulings: Q6, Q12, Q26.

## Acceptance criteria

- [x] A known selection gap, put back on purpose, makes the harness report a miss; a test proves it. Verified by "reports a miss when a known gap is put back" in [selectionReplay.test.mjs](../../../../scripts/selectionReplay.test.mjs), real git and vitest with the ticket 04 hole.
- [x] Selecting every test reports zero misses and a low precision, so over-selection cannot pass unnoticed. Verified by "reports no miss and a low precision when everything is selected": 0 misses, precision 1/4.
- [x] A summary records today's misses, precision, sample size and upper bound. See [selection-replay.md](../selection-replay.md): 3 misses of 36 bugs, precision 2.2%, upper bound 20.2%.
- [x] Each miss in today's selection is listed for ticket 13. See "Misses for ticket 13" in the same file: 3 bugs, 6 test files, each rerun alone with its bug.

For you: Decide whether the sample size is enough, from the harness summary.

## Landed

The result comes from a rescore, because a harness bug of mine contaminated the overnight run. The summary gives the account.

**Not verified:**

- The cause of the 3 misses. Ticket 13 owns it.
- Why each already-red test was red without the bug on older landings.
- A rerun with the fixed `--since` cutoff. It draws different landings from the recorded 12.

**For you:** Decide whether the sample size is enough, from the harness summary.
