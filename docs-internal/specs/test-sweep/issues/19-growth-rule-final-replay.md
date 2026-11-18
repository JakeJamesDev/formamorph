# 19: Growth Rule And Final Replay

Status: ready-for-human
Blocked by: 16, 17, 18
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: A small tooling change and a measurement; the rule text needs care to stay short and usable.

Parent: [Test Sweep spec](../spec.md)

## What to build

The suite stays lean after the sweep (Q16). `test-bar` gains a level and risk bar, from what the sweep learned. The slow-test reporter warns on slow new tests and never fails a gate. `test-bar` lives in the user's global skills folder, outside the repo, so the ticket hands the proposed text to the spec session and the owner approves it.

Then the harness and a full-suite measurement rerun on the final tree, under the owner's AFK signal, and the result is compared with the Q3 targets for close-spec.

Rulings: Q3, Q6, Q12, Q16.

## Acceptance criteria

- [x] A slow new test produces a warning naming it, and the gate still passes; a test proves it. `the new-test budget warning` in `slowTestReporter.test.mjs`: a real vitest run in a temp repo exits 0 and names the added, untracked and retitled tests, not the old or moved one; 5 mutations each turned it red.
- [x] The proposed `test-bar` text is in the ticket. Approved and applied to the global skill (Q69).
- [x] A final summary compares full-suite time, gate time, misses and precision with the Reference Run and the Q3 targets. See "Final Summary" below.

For you: Approve the `test-bar` text; judge the final numbers against your targets.

## Proposed `test-bar` text

A new section after "Testing the real thing", and one checklist line. The owner approved it with budgets kept out of the global skill (Q69).

> ## Pick the level, then the depth
>
> ### Lowest level that can fail
>
> Write the test at the lowest level where the bug can show. Each level up costs about ten times the time per test.
>
> | Level | Use it for |
> |---|---|
> | Unit | Logic, parsing, math, state transitions |
> | Component | One panel's behavior, through its real props and context |
> | View | Wiring only: the panel is there, the call reaches it, the result lands |
>
> The project sets each level's per-test budget, and its reporter warns when a test runs past it.
>
> - A view keeps a few wiring tests. Panel behavior goes in the panel's own test.
> - Don't test one behavior at two levels. The lower test guards it; the higher one only costs time.
> - A guard over source text (an import ban, a naming rule) is a lint rule, not a test that reads files.
> - A new test past its budget gets a warning. Make it faster or move it down a level before it lands.
>
> ### Depth follows risk
>
> - **High risk** (data loss, saves, import and migration, auth, money, sandboxes, anything irreversible): measure coverage and mutation-test each guard.
> - **Elsewhere:** one reinstated bug turns the test red. That is enough.
> - A test tied to a real bug fix stays until another test proves it would catch that bug too.
>
> ### What doesn't count
>
> - **Weak:** the assertions stay green with the named behavior broken. Judge the whole test, not one line.
> - **Asserts nothing:** it prints a report or a snapshot no one reads. Assert the fact, or delete it.
> - **Change detector:** it pins incidental output (markup, call order, exact copy) instead of the promise. It fails on every refactor and on no bug.
> - **Expired:** a rename guard or a parity suite outlives its migration. Give it an end condition, and remove it once the change ships.
>
> Checklist: `- [ ] Lowest level that can fail; within its budget; depth matches the risk`

## Final Summary

Measured 2026-11-18 from 11:05 to 18:31 UTC, in the owner's AFK window, on this ticket's tree (`7ecc9ec04`). No peer held the gate lock in the window: no gate log changed. The per-minute CPU sampler recorded nothing, because the driver's `spawnSync` blocked its timer, so this run has no CPU series.

| Measure | Reference Run | Q3 target | Final | Met |
|---|---:|---:|---:|---|
| Full suite, wall | 330 s | 240 s | 369 s (median of 375, 369, 368) | ❌ |
| Affected gate, warm | 279 s on 610 files | 200 s | 246 s on 681 files (similar sample) | ❌ |
| Replay misses, raw | – | 0 | 4 in 39 bugs, bound 22.0% | ❌ |
| Replay misses, adjusted | – | 0 | 1 in 36 bugs, bound 12.5% | ❌ |
| Precision | 1.7% (ticket 13, seed 2) | – | 1.3% | – |

### Full suite

- All three runs exited 0 with 0 unhandled errors.
- The suite grew 19%: 2,082 files and 37,510 tests, from 1,745 and 31,851.
- Worker time fell 14%, from 6,248 s to 5,383 s, or from 196 ms to 144 ms per test. Import fell 18% (2,049 → 1,685 s), setup 59% (512 → 211 s) and environment 27% (773 → 567 s). Test bodies stayed at 2,912 s against 2,901 s.
- **Open finding:** wall time rose while worker time fell. Effective parallelism (worker s / wall s) fell from 18.9 to 14.6. `maxWorkers` is unchanged at 50%. The cause is not found, and this ticket does not investigate it.

### Gate

The Q3 sample `6adfa5bf8` was lost in the history rewrite. **Similar sample, not the same:** `77da53e98`. Its 24 changed files reach 691 test files through imports. That is the closest to 610 among the 24-file landings of 2026-10-31 to 11-03. Both selectors ran warm on this tree.

| Selector | Test files | Vitest s | Gate s |
|---|---:|---:|---:|
| Today's | 681 | 213.7 | 245.5 |
| Ticket 13's Base (`dcfe6aac6^`) | 679 | 239.9 | 248.4 |

Today's gate includes a 19 s rerun of `GameViewer.bundledSaves.test.tsx`, which timed out once and passed alone. Without it, the gate took about 226 s.

### Replay

Seed 3, a fresh sample: 12 landings, 40 code mutants and 20 data mutants since 2026-10-01. The 6.79 h cap stopped it at 63 of 72 cases (9 data mutants not run). Precision was 1.3%, and the gate selected a median 10.3% of test files.

| Injected | Tried | Turned a test red | Missed |
|---|---:|---:|---:|
| Landings | 12 | 7 | 1 |
| Code mutants | 40 | 31 | 2 |
| Data mutants | 11 | 1 | 1 |
| **All** | 63 | 39 | 4 |

The misses:

- **3 are a flake:** the emberwatch case in `GameViewer.bundledSaves.test.tsx` ("made at the pre-expansion revision … plays a turn"), red under unrelated changes in `devStorageSample.ts`, `useAvatarDetailsOpen.ts` and `src/notes/WorldManagementPlan.md`. On the clean tree it failed alone 2 times in 14 ("Unable to find … Regenerate Narration" after 12 s). The drone case in the same describe failed 7 times in 13. These leave the adjusted count.
- **1 stays a miss:** `elementIcons.test.ts` on landing `01db1ef0f` (2026-10-11). That test was a source scan then, and ticket 14 moved the scan to `eslint.element-icon-import.js`. Today's ESLint config, run on that landing's files, flags nothing, so the current gate wouldn't catch it either.

The budgets in `BUDGET_MS` ([slowTestReporter.mjs](../../../../scripts/slowTestReporter.mjs)) are each level's p99 in the 2026-11-04 ledger. Close-spec recomputes them from the final Reference Run.

## Landed

**Not verified**

- The full suite and gate runs have no CPU series, because the per-minute sampler failed. The gate logs show peer gates idle, but other peer work can't be ruled out.
- The gate sample is similar to the Q3 sample, not the same, so the gate row compares only roughly.
- The replay stopped at 63 of 72 cases. 9 data mutants never ran.

**For you**

- For you: Approve the `test-bar` text; judge the final numbers against your targets. Neither time target is met: full suite 369 s against 240 s, and gate 246 s against 200 s.
- Judge the adjusted replay count: 1 miss in 36 (bound 12.5%). The raw count is 4 in 39 (22.0%).
- Open findings for close-spec:
  - Parallelism fell from 18.9 to 14.6 workers, and the cause is unknown.
  - `GameViewer.bundledSaves` flakes when run alone (emberwatch 2 in 14, drone 7 in 13). It needs its own ticket (Q14).
  - Today's gate has no equivalent for the `elementIcons` call-site guard on landing `01db1ef0f`.
