# 10: Parity Probes

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: runs the existing baseline harness with two arms; it needs an agreed GPU window, not deep reasoning.

## What to build

Measure narration changes from the switch (spec: Testing Decisions; Q12, Q21). This doesn't block the merge.

- Run the baseline harness on Cydonia, the node-llama-cpp engine (from main) against `llama-server` (this branch), with an in-batch control, at least 5 runs per arm.
- Report the rubric scores, paragraph-break counts and repetition per arm. Repetition Penalty now counts prompt tokens and line breaks, so watch those two.
- Local runs need a GPU window the user agrees to. Ask before starting.

## Acceptance criteria

- [x] Probe numbers per arm, with the in-batch control, in the landing. (`parity-score.mjs` over 15 dumps; table below)
- [x] Any regression is named with its metric, and a follow-up is proposed rather than fixed here. (none found; see below)

For you: read a few paired outputs from each arm and judge whether the narration changed in a way you care about.

## Landed

Setup: Sedge Landing, profile A (7 narration turns, other passes off), Cydonia 24B Q4_K_M, ctx 8192, 5 runs per arm, interleaved A / B / A' per round. A and A' = node-llama-cpp engine from `main` (e0b02fbe6) via the new `--engine-root` option of `run.mjs`; B = `llama-server` from this branch. The same app and harness drove all arms. Values are mean±sd over 5 runs.

| Arm | Words/turn | Paragraphs/turn | Single-paragraph turns | Line breaks/turn | Repeated pairs (8-gram, ≥3) | Shared 8-grams |
|---|---|---|---|---|---|---|
| A (node-llama-cpp) | 179.6±20.5 | 6.97±1.24 | 0 | 11.9±2.5 | 0.2±0.4 | 0.8±1.6 |
| B (llama-server) | 165.4±21.3 | 7.63±1.27 | 0 | 13.3±2.5 | 0.0±0.0 | 0.4±0.8 |
| A' (control) | 176.6±35.6 | 7.03±1.17 | 0 | 12.1±2.3 | 0.2±0.4 | 1.0±1.3 |

- All 15 runs completed 7/7 turns with no empty narration.
- The A–A' gap is 3 words and 0.06 paragraphs. B differs from A by −14 words (−8%) and +0.66 paragraphs. Both B gaps are about one standard error (sd/√5 ≈ 0.55 paragraphs, ≈ 9 words), so neither is a clear change.
- Repetition did not rise: B shows no more repeated pairs or shared 8-grams than A. No paragraph-break loss: every turn in every arm has several paragraphs.
- No regression is named. No follow-up is proposed.
- Method gaps: the rubric items (name discipline, world-fact fidelity) were not graded; the sample is 5 runs on one local model. Read-through of paired turns 3 and 6 (run 1): both arms hold the voice and paragraph rhythm. B's turn 6 gives the woman a name ("Odette") unprompted; one sample, not a trend.
- Raw dumps and batch log: `parity-dumps/` in the spec session's shared notes folder. Rerun: `node testing/baseline/harness/run.mjs --profile A [--engine-root <main checkout>]` once per run, then `node testing/baseline/harness/parity-score.mjs arm=dump.json …`. The old arm needs a checkout of `main` with a `node_modules` link.

### Not verified

- Hand-graded rubric scores (BASELINE-TEST items 4, 5, 10, 13) per arm: only countable metrics were run.
- Repetition Penalty effect on a longer chat (> 7 turns) or on the cloud model.

### For you

- Read a few paired outputs from each arm (profile A, turn 6 is a good one) and judge the narration change. Dumps are in the notes folder named above.
