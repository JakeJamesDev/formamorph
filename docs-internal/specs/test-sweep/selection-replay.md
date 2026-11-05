# Selection Replay

Measured 2026-11-04 with [`scripts/selectionReplay.mjs`](../../../scripts/selectionReplay.mjs) on base `395803b36`, seed 1, landings since 2026-10-01. This is today's selection, the starting number for ticket 13.

## Result

| Injected | Tried | Turned a test red | Missed | Miss rate upper bound (95%) |
|---|---:|---:|---:|---:|
| Landings | 12 | 5 | 0 | 60.0% |
| Code mutants | 40 | 25 | 0 | 12.0% |
| Data mutants | 20 | 6 | 3 | 84.7% |
| **All** | 72 | 36 | 3 | 20.2% |

- **Misses:** 3 of 36 bugs, 6 test files.
- **Sample size:** 36 bugs turned a test red. 36 more turned nothing red and say nothing about selection.
- **Upper bound:** exact binomial at 3 misses, rule of three on a row with 0 misses.
- **Precision:** 2.2%. The gate selected a median 7.7% of test files.

⚠️ **All 3 misses delete a whole JSON file.** Line edits and code mutants had no miss. Treat the 20.2% as a figure for the whole mix, not for any one kind of change.

## Sample size

The owner decides whether 36 is enough. Each full case took about 7 minutes.

| Bugs that turn a test red, 0 misses | Upper bound | About how many cases at today's 50% yield | About how long |
|---:|---:|---:|---:|
| 36 | 8.3% | 72 | 8 h |
| 60 | 5.0% | 120 | 14 h |
| 100 | 3.0% | 200 | 23 h |

## Misses for ticket 13

Each file below went red in the full run, red again alone with the bug, and green without the bug.

| Bug | Red test, not selected | Red alone with the bug |
|---|---|---|
| Delete `src/lib/tts/g2p/vocab.json` | [g2pModel.test.ts](../../../src/lib/tts/g2pModel.test.ts): file failed to load | Yes |
| | [kokoroClient.test.ts](../../../src/lib/tts/kokoroClient.test.ts): file failed to load | Yes |
| | [kokoroVoiceLoading.test.ts](../../../src/lib/tts/kokoroVoiceLoading.test.ts): file failed to load | Yes |
| | [textToPhonemes.test.ts](../../../src/lib/tts/textToPhonemes.test.ts): file failed to load | Yes |
| Delete `src/defaultworlds/open-chat.json` | [defaultWorlds.test.ts](../../../src/lib/defaultWorlds.test.ts): "isDefaultWorldId lists exactly the bundled world files, so the seeder finds each one" | Yes |
| Delete `src/lib/formaquestion/sectionVectors.json` | [sectionVectors.test.ts](../../../src/lib/formaquestion/sectionVectors.test.ts): file failed to load | Yes |

**Cause not confirmed.** The likely one: `vitest related` can't follow an import to a file that is gone. Ticket 13 owns the check.

## How the number was made

Two runs fed this result.

1. **Overnight run, not usable.** 70 of 72 cases in 8 hours. Its raw report showed 22 bugs with misses.
2. **Rescore, the table above.** It reused the overnight mutant reds and rechecked each one alone with its bug applied.

**The contamination was my harness bug.** The harness test's clones and the replay's clone shared a folder name. So that test deleted the replay's live module cache, and other test files failed with `ENOENT`. It also turned the harness test itself red in many cases.

- The clone name is now per root, and a sentinel test guards it.
- The rescore dropped `scripts/selectionReplay.test.mjs` from the stored reds. No sampled mutant changes a file that test reads.
- The rescore filtered 84 red files that went green alone and 27 that were red without the bug.

### What differs between the two runs

- **Landings:** the rescore replayed 12 landings in full, so they are clean. They aren't the overnight 12.
- **Why they differ:** `--since` with a date alone took git's current time of day, so the commit pool moved through the day. The cutoff is now the start of that date in UTC, and a test guards it. A rerun with seed 1 draws a stable set that differs from these 12. Each draw was uniform, so the numbers stand.
- **Mutants:** the same 60. The 2 the overnight run didn't reach ran in full on the base.

## What the rescore can't fix

The rescore rechecks reds only. So a deleted cache could hide a real red only through a file that never reported.

**There are no such cases.** All 60 mutant full runs reported 1,803 files, the base's test file count. All 12 landing full runs reported exactly the count in their parent's tree. A file that fails to load reads as red, so it reaches the recheck.

## Peer load

| Run | Peer gate lock samples, once a minute | When |
|---|---|---|
| Overnight | 1 of 481 | 13:21 UTC, in the mutant phase |
| Rescore | 5 in a row | 00:30 to 00:34 UTC, in the landing phase |

- **Ticket 15's ledger run** (6 test files) overlapped the overnight start for up to about 5 minutes. That period held only overnight landings, and the rescore doesn't use them.
- Load can only add reds. Every red had to go red again alone, so a timeout from load can't become a miss.

## Limits

- **A red seen only under load is dropped.** The recheck runs a test alone, so a bug that shows only in a parallel run doesn't count.
- **Already-red tests can't score.** On older landings these files were red without the bug: `GameViewer.bundledSaves`, `scripts.migration`, `statLookupMigration`, `bundledRevisions`, `bundledWorlds`. The cause isn't confirmed for each file.
- **An unhandled error beside a named red is invisible.** The harness can't tell that error from the named red.
- **Mutants go in one place at a time.** A real landing can combine changes in ways a single mutant doesn't.

## Rerun it

```bash
node scripts/selectionReplay.mjs run --landings 12 --code-mutants 40 --data-mutants 20 --seed 1 --since 2026-10-01 --max-hours 8
```

```bash
node scripts/selectionReplay.mjs report
```

Both default to `.git/selection-replay`. Run it only in an agreed AFK window (Q6).
