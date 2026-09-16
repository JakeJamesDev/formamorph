# 03: Shipped Caps For Choices, Stat Updates And Location Change

Status: ready-for-human
Base: 9cfe9b24
Blocked by: 02 — Max Output Row On The Capped Prompts
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: [Prompt Output Caps](../spec.md)

## What to build

The three calls that send no cap today gain one.

- Choices gets a fixed shipped cap of 256 in the pass cap table and a Max Output row on its tab, whose Auto readout shows 256.
- Stat Updates gets a computed cap of 16 tokens per stat plus 16, from the plan input's stat count. No row.
- Location Change gets a computed cap of the longest destination name's estimated tokens plus 8, from the material's destination list, using the pipeline's existing token estimator. No row.

Both computed caps live in the pass records' request builders, so the Turn Plan carries a number and the AI Request Spec sees no difference from a fixed cap.

The choices cap ships with probe evidence: run the choices prompt on both reference tiers (Silver-Siren 12B and G4-MeroMero 31B) at 256, at least two runs per case, and count replies cut before the last choice. Record the numbers in the ticket's Comments. If the average tier loses its last choice, raise the value and say so in the spec session before shipping.

## Acceptance criteria

- [x] The choices pass builds a request with `maxTokens: 256`. The Choices tab shows the row with `Auto · 256 tok`.
- [x] The stat pass builds a request whose cap equals `16 × statCount + 16`, proven at two stat counts.
- [x] The location pass builds a request whose cap grows with the longest destination name, proven with a short and a long name.
- [x] The Reasoning Budget on Choices is non-zero on an endpoint with no Max Output override.
- [x] Probe results for the choices cap recorded under Comments, both tiers, with the cut-reply count per run.
- [x] Four gates green; `graphify update .` run.

## Notes

Workload rationale: two world-derived caps inside the pass records plus a live-model probe that must be read honestly. The probe is the long pole.

## Comments

### Choices cap probe (2026-09-16)

`node testing/baseline/harness/choices-probe.mjs --endpoint http://127.0.0.1:1234/v1/chat/completions --model <m> --runs 3 --max 256`, LM Studio, no temperature (Choices has no sampler pin). A run is "cut" when `finish_reason` is `length`.

| Case | Silver-Siren 12B (opts · tok, runs 1/2/3) | G4-MeroMero 31B (opts · tok, runs 1/2/3) |
|---|---|---|
| standoff | 4·56 · 4·55 · 5·72 | 5·67 · 4·61 · 4·56 |
| discovery | 5·54 · 5·69 · 5·72 | 4·56 · 4·64 · 4·67 |
| gossip | 5·58 · 5·50 · 5·63 | 5·70 · 4·61 · 4·63 |
| ford | 5·56 · 5·57 · 4·41 | 4·59 · 4·53 · 4·59 |
| arrival | 4·49 · 4·45 · 5·54 | 4·58 · 4·58 · 4·57 |
| reunion | 4·61 · 4·46 · 3·29 | 5·75 · 5·70 · 5·71 |
| **Cut** | **0 / 18** | **0 / 18** |
| Longest reply | 72 tok | 75 tok |

Contract metrics on both tiers: bad-count 0, leaks 0, multi-sentence 0. 256 is about 3.4× the longest reply, so no tier loses its last choice. 256 ships unchanged.
