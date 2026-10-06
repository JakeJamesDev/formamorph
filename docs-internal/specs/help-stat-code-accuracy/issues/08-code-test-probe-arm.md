# 08: Code Test Probe Arm

Status: done
Blocked by: 06 — Code Test Function; 07 — Code Probe Cases And Bar
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a local-model probe that needs the GPU; the user must agree a window first.

## What to build

The code test function is measured: Quick Reference plus the function against Quick Reference alone, on a local tool-calling model (Cydonia 24B on LM Studio), using the five cases from ticket 07 at 5 or more runs per arm with `reasoning_effort: "none"`. The run happens in a GPU window the user agrees to; it never starts mid-session. On a gain, the setting's default stays on. On no gain, the default flips to off. The spec records the numbers either way.

## Acceptance criteria

- [ ] Before any run, check what LM Studio has loaded and ask the user for a window
- [ ] Both arms run on the same model with an in-batch control, 5+ runs per case
- [ ] The five cases from 07 are re-measured against the Q9 bar, with the persona case called out (Q29)
- [ ] Numbers recorded in the spec with the default decision
- [ ] Setting default matches the decision; changelog fragment written if it flips

## Results

**Baseline batch (2026-10-05).** MeroMero v2 31B (`g4-meromero-v2-31b-i1`, Q4_K_M, 8192 context loaded) on LM Studio, the only model loaded. Code at main `db150afd` (tickets 09 and 10 in). 13 code cases × 2 arms × 5 runs, interleaved, one request at a time, `reasoning_effort: "none"`. 130 questions in 1621 s, 0 failed.

```bash
npx vite-node testing/baseline/harness/help-code-probe.cli.ts -- --tools --endpoint http://127.0.0.1:1234/v1/chat/completions --model g4-meromero-v2-31b-i1 --runs 5 --parallel 1 --only <the 13 code case ids>
```

| | rider (Quick Reference alone) | test (plus the code test) |
|---|---|---|
| Known cases pass (Q9, ≥80%) | 84% (21/25) | 76% (19/25) |
| Persona case (Q29) | 100% (5/5) | 40% (2/5) |
| brave-at-courage | 20% | 40% |
| The other three known cases | 100% each | 100% each |
| Other code cases run | 100% | 100% |
| Fence, closed, tagged | 100% | 100% |
| Code test calls | – | 0 in 65 answers |

- The model never called `test_stat_code`. Every answer on both arms made 3 requests: the pick, one `set_face` round, and the answer.
- So this batch measures the function as offered, not as used (Q33).
- The test-arm persona misses write the world `traits.Seasoned`.
- **The known-case rates understate the model.** The request names the Code tab but never the open stat. Every brave-at-courage miss on both arms reads `self.value`, which is right when Courage's own Code tab is open. The case accepts only `stats.Courage.value`, so it rejects that valid answer. quotes-pin ("my Int") can reject the same way, though it passed 5/5 on both arms here.

**Corrected known-case rates (ticket 12).** The baseline's saved answers re-scored offline with `self.value` accepted on `brave-at-courage` and `quotes-pin`. The original rates reproduce first (21/25 and 19/25).

| | rider | test |
|---|---|---|
| Known cases pass, as first recorded | 84% (21/25) | 76% (19/25) |
| Known cases pass, corrected | 100% (25/25) | 88% (22/25) |
| brave-at-courage, corrected | 100% (5/5) | 100% (5/5) |
| Persona case (Q29), unchanged | 100% (5/5) | 40% (2/5) |

The stopped re-run saved no answers, so it cannot be re-scored.

**Stopped re-run (2026-10-05).** The same command after ticket 11 (`ef314b2c`) added the test-first line. Stopped by the user at 57 of 130 questions, so the probe wrote no summary. LM Studio's log shows 28 turns that called `test_stat_code`, each in the same turn as `set_face`, against 0 in the baseline. The model filled the `stat` input with invented names, such as `ProwlerStat`, since it does not know the open stat.

**Decision (Q37).** No new run. The code test's default stays on, as ticket 06 landed it.
- A first batch at 2 requests at a time is void: the two requests overflowed the 8192 context, and 68 of 130 returned HTTP 400. Run local batches with `--parallel 1`.
