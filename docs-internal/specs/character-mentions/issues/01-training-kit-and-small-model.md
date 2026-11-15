# 01: Training Kit and Small Model

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A tracked training kit that trains both architectures on one shared corpus: LingMess for the big model, FCoref for the small one. This ticket also produces the first clean small model. The scratch kit from the evaluation is the reference. Move its working parts into the repo, and leave corpora and weights untracked.

- **Corpus conversion:** LitBank (80/10/10 split) plus any number of extra corpus files in one annotation format. The seed set (ticket 12) and accepted contributions (ticket 09's export) use the same format.
- **Training and scoring:**
  - Training covers both architectures, is resumable, and keeps the GPU guard.
  - Scoring covers the LitBank dev split, the narration dev set when it exists, and our gold sets (real narration, hard set, blind set).
  - A report compares a run against the current published weights.
- **Export:** graphs follow the browser graph contract.
  - Graph A (encoder and mention logits) takes `input_ids`, `attention_mask` and `position_ids`. Graph B takes the antecedent inputs.
  - The browser fixes are mandatory: `position_ids` comes in as an input, LingMess's three-operand Einsum becomes MatMuls, and weights are weight-only int8.
  - This ticket owns the graph contract and documents it for ticket 02.
- **Manifest generation:** per model, a version, file URLs, sizes, SHA-256 hashes and the minimum host version. This ticket owns the manifest format; ticket 03 reads it.
- **Publish gate:** the kit refuses to write a manifest for a model that scores below the current published one on any dev set.
- **Small model:** train the FCoref-architecture model on LitBank. The GPU run happens only in a window the user agrees to, so ask before starting it.
- **Changelog:** no fragment, because nothing changes for the player.

## Acceptance criteria

- [x] The kit trains, scores and exports the existing e120 checkpoint. Its exported graphs match the scratch export's outputs on the parity case. — `export.py --compare .scratch/webbench/litbank`: max diff 0 on `sequence_output`, `mention_logits` and `final_logits`; fp32 ONNX clusters equal PyTorch on the parity passage; fp32 graphs score LitBank dev 0.6948, the run's own `best_f1`. Training: `--smoke` runs of both architectures, stopped mid-run (exit 3) and resumed to the end.
- [x] A small FCoref model trained on LitBank only exists, with its scores on all sets reported in the ticket. — `runs/small-litbank`, 120 epochs in 40 min on the 4090; scores below.
- [x] Exported graphs of both models pass the browser parity bench on WebGPU and WASM. The bar is top-k mention overlap 1.0 and antecedent argmax agreement 1.0 against CPU fp32. — `bench/run.mjs`, onnxruntime-web 1.31.1, Chrome: small and big each 1.0 / 1.0 on WebGPU (NVIDIA Lovelace) and WASM, against the same int8 graphs on onnxruntime CPU (ruling 6).
- [x] The manifest generator writes a manifest for both models, and the publish gate refuses a model that scores lower. — `manifest.test.ts` (12 tests; tie, lower, changed dev set and missing manifest each proved by reinstating the bug); live run: both models first-published, a tie refused, the smoke model (dev 0.0005) refused.
- [x] The kit's README documents the graph contract and the manifest format. — `testing/coref/README.md`, plus the corpus, annotation and gold formats.
- [x] No OntoNotes-trained weights serve as a starting point or teacher. — bases `allenai/longformer-large-4096` (e120) and `distilroberta-base` (small); no teacher.

For you: agree on a GPU window for the small-model training run.

### Scores

Shipped int8 graphs, onnxruntime CPU with optimizations off. Gold sets are cluster-only (README, "What gets scored"); narration dev does not exist until ticket 12.

| Set | Big (e120) | Small (LitBank) |
|---|---|---|
| LitBank dev, CoNLL F1 | 0.6895 | 0.5924 |
| Real: link F1 · pronouns · negatives | 0.985 · 151/153 · 41/41 | 0.901 · 150/153 (1 wrong) · 27/41 |
| Hard: link F1 · names · descriptors · pronouns · negatives | 0.857 · 14/16 · 9/15 · 43/50 · 8/8 | 0.818 · 15/16 · 13/15 · 50/50 · 6/8 |
| Blind: link F1 · names · descriptors · pronouns · negatives | 0.830 · 74/81 · 27/43 (1 wrong) · 124/136 (1 wrong) · 39/44 | 0.556 · 63/81 (3 wrong) · 27/43 (4 wrong) · 120/136 (8 wrong) · 32/44 |

PyTorch for reference: big 0.6948, small 0.5963 on LitBank dev. Graph sizes: small 139 + 4 MB, big 369 + 148 MB.

## Landed

**Not verified**

- The corpus guard test (`test_corpus.py`, Q39) is Python and runs only in the kit's venv, so the app's gates never run it. Ran green here, and red with the old `sys.exit`.
- Distillation from e120 (ruling 7) was not tried; the supervised run is the bar.

**For you**

- For you: agree on a GPU window for the small-model training run.
- The small model is well behind the big one on the blind set (link F1 0.556 vs 0.830, pronouns 8 wrong). Decide whether a distilled small model is worth a GPU window before ticket 03 ships it.
- LitBank (CC BY 4.0) needs a Credits entry once weights ship; no ticket owns it yet.
