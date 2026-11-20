# Coreference Models: Training Kit

Character Mentions links names, pronouns and descriptors in narration to the cast, with an on-device coreference model. This folder trains both models on one corpus, scores them, exports them for the browser and writes the manifest the app downloads from.

| Model | Architecture | Encoder | Runs when |
|---|---|---|---|
| **big** | LingMess | Longformer large | WebGPU passes the speed probe |
| **small** | FCoref | DistilRoBERTa | everywhere else |

> ⚖️ **Clean data only.** Training uses LitBank (CC BY 4.0), our seed set and accepted player corrections. No OntoNotes data, no OntoNotes-trained weights as a starting point, and no OntoNotes-trained teacher.

## 📁 Where things live

| What | Where | Tracked |
|---|---|---|
| The kit | `testing/coref/` | ✅ |
| LingMess training code (MIT) | [`vendor/lingmess_coref/`](vendor/lingmess_coref/) | ✅ |
| Gold sets, seed set, accepted corrections | the private `formamorph-training-data` repo, under `coref/` | 🔒 private repo |
| LitBank checkout, venv, corpus, runs, exports, scores | `.scratch/coref/` in the main checkout | ❌ |

- The kit finds the data repo at `../formamorph-training-data`, next to the main checkout. Set `FORMAMORPH_TRAINING_DATA` to use another folder.
- Set `COREF_WORK` to move the `.scratch/coref/` work folder.
- CPU steps use a quarter of the cores. Set `COREF_THREADS` to change that.

## 🛠️ Setup

```bash
python -m venv .scratch/coref/env
.scratch/coref/env/Scripts/python -m pip install torch==2.15.0 --index-url https://download.pytorch.org/whl/cu132
.scratch/coref/env/Scripts/python -m pip install -r testing/coref/requirements.txt
git clone https://github.com/dbamman/litbank .scratch/coref/litbank
```

The Python tests need this venv, so the app's test run skips them. Run them with `.scratch/coref/env/Scripts/python -m unittest testing/coref/test_corpus.py`. The manifest tests (`manifest.test.ts`) run with the app's tests.

## 🔁 A retrain, step by step

Run every command from the repo root with the venv's Python (`$PY` below).

**1. Build the corpus.** LitBank splits 80/10/10 with a fixed seed. Add the seed set, accepted corrections and hand-fixed contributions:

- `accepted.jsonl` is the server's export of accepted contributions. Refresh it before each retrain.
- `hand-fixed.jsonl` holds queue passages we labeled by hand. Its lines start `"reviewed": false`, so review them in the seed editor first.

```bash
$PY testing/coref/corpus.py --litbank .scratch/coref/litbank \
  --add train:../formamorph-training-data/coref/corpus/accepted.jsonl \
  --add train:../formamorph-training-data/coref/corpus/hand-fixed.jsonl \
  --add narration-dev:../formamorph-training-data/coref/seed/dev.jsonl
```

**2. Train.** ⚠️ This holds the GPU for a long time. Agree on a window first.

```bash
$PY testing/coref/train.py --arch fcoref --run small-2026-11
$PY testing/coref/train.py --arch lingmess --run big-2026-11 --epochs 120
```

- The GPU guard refuses to start when CUDA is missing or more than 3000 MiB of GPU memory is in use.
- Stop with Ctrl+C, or create `.scratch/coref/runs/STOP`. The run saves and exits with code 3.
- Run the same command again to continue. It deletes the STOP file first. State also saves every 10 minutes (`SAVE_MINUTES`).
- `GC=0` turns off gradient checkpointing for LingMess. `AMP=fp16` trains in fp16 instead of bf16.
- The best checkpoint on LitBank dev lands in `runs/<run>/model`. `best_f1.json` marks a finished run.
- `--smoke` runs two short epochs on a corpus slice, on 4 CPU threads. It proves the loop, not the model.

**3. Export.**

```bash
$PY testing/coref/export.py --checkpoint .scratch/coref/runs/small-2026-11/model --out .scratch/coref/exports/small-2026-11
```

It fails when the fp32 graphs give different clusters than PyTorch on the parity passage. `--compare <older export>` runs another export of the same checkpoint on the same inputs, and fails when any output differs by more than 1e-4.

**4. Score the export.** Scores always come from the shipped int8 graphs:

```bash
$PY testing/coref/score.py --checkpoint .scratch/coref/runs/small-2026-11/model \
  --export .scratch/coref/exports/small-2026-11 --out .scratch/coref/scores/small-2026-11.json
```

**5. Check browser parity.** Needs installed Chrome and onnxruntime-web:

```bash
node testing/coref/bench/run.mjs --exports .scratch/coref/exports --ort node_modules/onnxruntime-web small-2026-11
```

`--ep wasm` runs one backend only. The bar: on WebGPU and on WASM, top-k mention overlap and antecedent argmax agreement are 1.0 against the same graphs on onnxruntime CPU. The line also shows both numbers against the fp32 graphs, for information.

**6. Compare and publish.**

```bash
node testing/coref/manifest.mjs report --model small --scores .scratch/coref/scores/small-2026-11.json --current https://<models host>/coref/manifest.json
node testing/coref/manifest.mjs publish --model small --export .scratch/coref/exports/small-2026-11 \
  --scores .scratch/coref/scores/small-2026-11.json --current https://<models host>/coref/manifest.json \
  --base-url https://<models host>/coref --out .scratch/coref/publish
```

Upload `publish/small/<version>/` first, then `publish/manifest.json`. When `--current` does not exist yet (HTTP 404, or no file), nothing is published, and the first publish passes.

## 🌱 The narration seed set

About 100 passages of real narration from the bundled worlds, labeled by a model and then corrected by hand. Once corrected, they are the `narration-dev` set. They live in the data repo at `coref/seed/dev.jsonl`.

**1. Play.** Plays the bundled worlds in the real dev build on the cloud endpoint, with scripts that pull several characters into talk ([`seed-worlds.ts`](seed-worlds.ts)). Each turn's stored narration becomes one passage, with its world, run, turn and action:

```powershell
npx vite-node testing/coref/seed-play.cli.ts -- --worlds all
```

- It writes `coref/seed/play/<batch>.jsonl` in the data repo. `--worlds` and `--runs` narrow a batch; `--endpoint` and `--model` change the target.
- An opening page the world wrote itself is left out: only model narration counts. Turn numbers still count it.

**2. Pre-label.** Labels the new passages with the current big model (LitBank e120) on the CPU and adds them to the seed file as `"reviewed": false`. Passages already in the file keep their labels:

```powershell
.scratch/coref/env/Scripts/python testing/coref/seed_label.py --checkpoint <e120 checkpoint> --export .scratch/coref/exports/big-e120 ../formamorph-training-data/coref/seed/play/<batch>.jsonl
```

**3. Correct.** Open [`seed-editor.html`](seed-editor.html) in Chrome, then open the seed file with **Open**. Chrome saves back to the same file.

- Click a mention to select it; click again for the mention around it. Drag across words to add a mention.
- `1`–`9` moves the selection to that cluster, `N` starts a new cluster, `Delete` removes it.
- `R` marks the passage reviewed, `←` `→` change passages, `Ctrl+Z` undoes, `Ctrl+S` saves.

**4. Score.** Build the corpus with the seed file as `narration-dev` (step 1 of a retrain), then score. Passages still marked `"reviewed": false` are left out of the corpus, and `corpus.py` prints how many.

## 🧪 A local manifest for the dev server

The dev server serves `.scratch/coref/publish` at `/coref-dev/`, and the app reads its manifest there until the public bucket exists. Publish each export there with `--base-url /coref-dev`:

```powershell
node testing/coref/manifest.mjs publish --model small --export .scratch/coref/exports/small-litbank --scores .scratch/coref/scores/small-litbank.json --current .scratch/coref/publish/manifest.json --base-url /coref-dev --out .scratch/coref/publish
```

- Run it once per model. The second run keeps the first model's entry.
- `COREF_DEV_DIR` serves another folder. `VITE_COREF_MANIFEST_URL` points the app at any manifest.

## 🚦 The publish gate

Each model publishes on its own. `publish` refuses a model unless, on every dev set the published version has:

- the dev file is the same (same SHA-256), and
- the new F1 is not lower.

At least one dev set must also be strictly higher. A tie everywhere is refused. When a dev set has changed since the last publish, score the published export on the current set and publish against those numbers.

## 📊 What gets scored

| Set | Source | Score |
|---|---|---|
| `litbank-dev` | LitBank dev split, 10 books | CoNLL F1 (mean of MUC, B³, CEAFe) — **gated** |
| `narration-dev` | corpus files added as `narration-dev` | CoNLL F1 — **gated** |
| gold `real`, `hard`, `blind` | data repo `coref/gold/` | cluster-only, reported |
| gold `quotes` | data repo `coref/gold/quotes.json` | clusters only; the app's tests score speakers |

`--preds <tag>` also writes the model's clusters for every gold passage to `coref/gold/preds/<tag>.json` in the data repo, as `{"model": tag, "clusters": {"<set>:<id>": [[[start, end], …], …]}}`. The app's Mention Reading tests read them.

Onnxruntime CPU sessions run with graph optimizations off. With them on, onnxruntime fuses `DequantizeLinear` and `MatMul` into an int8 kernel that the browser never runs.

The gold scores need no naming step:

- **link F1:** pairs of gold character mentions; a pair is linked when both fall in one predicted cluster.
- **per kind (name, descriptor, pronoun):** ok when the mention's cluster holds another gold mention of the same character; wrong when it holds only other characters' mentions.
- **negatives:** a mention that names no character is ok when its cluster holds no character mention.

The full Mention Reading score (cluster naming, In Scene) lives in the app's tests, because the naming rules have one implementation, in TypeScript.

## 📄 Formats

### Annotation format (seed set, accepted corrections)

JSON Lines, one passage per line:

```json
{"id": "seed-0042", "text": "Mira nodded. She drew a brass key.", "clusters": [[[0, 4], [13, 16]]]}
```

- `id` is unique across the whole corpus.
- Each cluster lists `[start, end)` character offsets into `text`.
- A span that does not fall on spaCy word boundaries is skipped, and `corpus.py` lists it. The build goes on.
- Clusters with one mention are dropped.
- A passage with `"reviewed": false` is a pre-label not yet corrected, and the corpus leaves it out.
- Other fields are ignored. Seed passages also carry `source` (world, run, turn, action, model, batch) and `labeledBy`.

### Corpus (token form)

`corpus.py` writes `{doc_key, tokens, clusters}` per line, with clusters as inclusive word-index spans. Both trainers read this form.

### Gold sets

`coref/gold/<set>.json` in the data repo, for `real`, `hard` and `blind`. The quote-speaker set goes in `quotes.json` in the same shape.

```json
{"set": "blind", "passages": [{
  "id": "f-ivy-grace-garden",
  "text": "…",
  "cast": [{"id": "grace", "name": "Mother Grace Abernathy", "aliases": ["the abbess"], "strangerName": "a stern old nun"}],
  "present": ["grace"],
  "mentions": [{"start": 48, "end": 85, "text": "A severe old nun in a starched wimple", "entity": "grace"}],
  "quotes": [{"start": 120, "end": 161, "speaker": "grace"}]
}]}
```

- Offsets are `[start, end)` into `text`. The texts hold no characters outside the Basic Multilingual Plane, so Python and JavaScript offsets agree.
- `entity` is a cast id, or `NONE` / `OTHER` for a mention that is not a cast character.
- `speaker` is a cast id, or `null` when nobody in the cast speaks.
- `cast` entries can also carry `generic: true`.

## 🔌 Graph contract (version 1)

Each export ships four files. The host reads `host-config.json` and must support its `graphContract`.

| File | Contents |
|---|---|
| `graph_a.onnx` | encoder and mention logits |
| `graph_b.onnx` | antecedent logits |
| `tokenizer.json` | RoBERTa byte-level BPE, prefix space on |
| `host-config.json` | `architecture`, `top_lambda`, `max_span_length`, `max_segment_len`, `graphContract` |

**Words, then subwords.** Graph A takes RoBERTa BPE ids over spaCy-style words, with `<s>` first and `</s>` last.

**Position ids are an input.** Pads take 1. Other tokens take 2, 3, 4, … counted per row. (WebGPU reads wrong rows from position ids computed inside the graph.)

**Weights are weight-only int8.** Each large weight is int8 with one fp32 scale per output channel, read through `DequantizeLinear`, so all math is fp32. Dynamic int8 (`MatMulInteger`) gives wrong results on WebGPU. LingMess's three-operand Einsum is rewritten as MatMuls, because it hangs WebGPU.

### Big (LingMess)

| Graph | Inputs | Outputs |
|---|---|---|
| A | `input_ids`, `attention_mask`, `position_ids`: int64 `[1, S]`, S ≤ 4096 | `sequence_output` f32 `[1, S, 1024]`, `mention_logits` f32 `[1, S, S]` |
| B | `sequence_output`; `starts`, `ends` int64 `[1, k]`; `span_mask` int32 `[1, k]`; `topk_mention_logits` f32 `[1, k, k]`; `categories_masks` int32 `[1, 7, k, k]` | `final_logits` f32 `[1, k, k + 1]` |

### Small (FCoref)

| Graph | Inputs | Outputs |
|---|---|---|
| A | `input_ids`, `attention_mask`, `position_ids`: int64 `[n, 512]`, the passage cut into 512-token rows, the last row padded | `start_reps`, `end_reps` f32 `[1, n·512, ffnn_size]` (1024 by default), `mention_logits` f32 `[1, n·512, n·512]` |
| B | `start_reps`, `end_reps`; `starts`, `ends` int64 `[1, k]`; `span_mask` int32 `[1, k]`; `topk_mention_logits` f32 `[1, k, k]` | `final_logits` f32 `[1, k, k + 1]` |

### Host steps between the graphs

1. Set `mention_logits[i][j]` to the float32 minimum where `attention_mask` is 0 at `i` or at `j`. Padding is never a mention.
2. Keep the top `k = floor(real tokens × top_lambda)` spans by mention logit, sorted by position. Starts are `index ÷ S`, ends are `index mod S`.
3. `topk_mention_logits[i][j]` = logit of span `i` + logit of span `j`. `span_mask` is 1 for the `k` kept spans.
4. Big only: `categories_masks` holds LingMess's seven pair categories for the kept spans.
5. Graph B's last column is the "no antecedent" choice (always 0). Each span links to its argmax; linked spans form clusters.

Reference code for these steps: `use_onnx` in [`kit.py`](kit.py), which `score.py` and `export.py` run.

## 🗂️ Manifest format (version 1)

```json
{
 "format": 1,
 "models": {
  "small": {
   "version": 3,
   "architecture": "fcoref",
   "minHostVersion": 1,
   "scores": {"litbank-dev": {"f1": 0.6512, "sha256": "…"}},
   "files": {
    "graph_a": {"url": "https://…/coref/small/3/graph_a.onnx", "size": 139276371, "sha256": "…"},
    "graph_b": {"url": "…", "size": 4228036, "sha256": "…"},
    "tokenizer": {"url": "…", "size": 3558642, "sha256": "…"},
    "hostConfig": {"url": "…", "size": 132, "sha256": "…"}
   }
  },
  "big": {"…": "same shape, architecture lingmess"}
 }
}
```

- `version` counts up by one per publish of that model. Files of a version never change.
- `minHostVersion` is the graph contract version. A host that supports a lower version skips the model.
- `size` is in bytes; `sha256` is the hex digest of the file.
- `scores` are the dev scores the gate compares against.

## 📚 Licenses

- **LitBank:** CC BY 4.0. Shipped weights are trained on it, so the app's Credits must name it.
- **lingmess-coref:** MIT, Shon Otmazgin, vendored at commit `3492a53`. Changes: resumable training (`training.py`, `run.py`), `AdamW` from `torch`, bf16 autocast, and CPU support for smoke runs.
- **fastcoref:** MIT, installed from PyPI. Its models are not used: only the architecture code, the inference wrapper and the metrics.
