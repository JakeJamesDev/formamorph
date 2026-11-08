# Embedder upgrade for semantic memory

Status: needs-triage. Probed 2026-11-06.

Question: should semantic memory move off `Xenova/all-MiniLM-L6-v2`, and is there a high-quality tier worth a setting?

## Rulings

- **R1 (2026-11-06):** the default moves to `Xenova/bge-small-en-v1.5`.
- **R2 (2026-11-06):** the high-quality tier is deferred.
- Open: what diary recall does under bge (see ▶ below).

## ▶ Resume here: diary recall under bge

**Diary recall does not work on either small model, under any firing rule tried.** The grown fixture showed that MiniLM's 0.34 never worked either. **embeddinggemma with a gap rule does work** (76% / 62% held out), which is the first concrete case for the deferred tier. Every other threshold transfers to bge. Options:

1. bge everywhere; diary recall falls back to recent-only until a diary-specific fix.
2. bge for band, lore and scene recall; MiniLM stays for diary only (two models, two vector caches). No longer justified: MiniLM is no better on diary.

### Grown diary fixture (2026-11-06)

[semantic-diary-cases.json](../../../testing/baseline/semantic-diary-cases.json) grew from 8 entries / 8 actions to **32 entries / 44 actions** (25 positives, 19 negatives, 11 of them hard: same topic or word, nothing to recall). A fresh agent wrote the new cases blind to models and scores. Ten actions were reworded to pass the probe's shared-word guard; no label changed.

| | MiniLM | bge |
|---|---|---|
| Shipped floor | 0.34: **19% precision / 42% recall** | (0.34 fires everything) |
| Best usable floor | 0.44: 78% / 27% | 0.66: 67% / 8% |
| Top-2 recall, no floor | 54% | 54% |
| AUC (threshold-free) | 0.89 | 0.86 |

- MiniLM's old 100% / 60% was a small-fixture artifact. At the shipped 0.34, four in five diary pulls are wrong.
- Ranking is equal: both models put the right entry in the top 2 for 54% of positives. Neither score is calibrated enough to decide whether to pull anything.
- Style, re-checked on the larger set: stripping first-person words lifts bge's AUC 0.86 → 0.91 and lowers MiniLM's 0.89 → 0.87. Voice is a small factor for bge, not the cause.

Diary recall ships dark (semantic memory is off by default), so no player sees this today.

### Diary firing rules (2026-11-06)

Script: `.scratch/embedder-probe/diary-rules.mjs`. Grown fixture, cap 2. Each rule's parameter is tuned on one half of the actions and scored on the other (stratified 2-fold); the table shows the held-out numbers at each fold's best-F1 parameter.

Rules: **abs** = today's floor. **zscore** = score against the character's own pool mean and spread. **center2** = minus the action's mean and minus each entry's "hubness" (its mean similarity to 77 real player actions from the Sedge Landing runs). **gap** = fire only the top entry, and only when it leads the second by a margin.

| Model | abs | zscore | center2z | gap |
|---|---|---|---|---|
| MiniLM | **92% / 27%** | 19% / 35% | 34% / 31% | 58% / 23% |
| bge | 29% / 27% | 39% / 35% | 31% / 38% | 26% / 38% |
| bge, no prefix | 36% / 27% | 28% / 42% | 32% / 35% | 59% / 23% |
| embeddinggemma q8 | 47% / 62% | 69% / 54% | 67% / 46% | **76% / 62%** |
| embeddinggemma, similarity prompt | 44% / 50% | 58% / 50% | 61% / 42% | 85% / 42% |

(precision / recall, held out)

- **No rule rescues diary recall on a small model.** MiniLM at a raised floor (0.45) is precise but recalls 1 in 4. bge never passes 60% precision.
- **embeddinggemma makes diary recall work.** Gap rule: 76% precision / 62% recall held out (83% / 58% at the precision-first setting). It is the only model where ranking and calibration both hold.
- Hubness correction did not help any model.
- Not tested: letting the character pass choose from the top candidates (an LLM-side pick). It costs tokens per character per turn.

## Recommendation (before rulings)

| Slot | Pick | Why |
|---|---|---|
| **Default** | `Xenova/bge-small-en-v1.5` q8, CLS pooling, query prefix | Fixes most real oblique misses (9 wins, 0 losses vs MiniLM). +11 MB. Same speed class. |
| **High-quality tier** | `onnx-community/embeddinggemma-300m-ONNX` q8 (or q4) | Best on the real save (44 wins, 16 losses). Not better than bge on oblique recall at cap 12. 200–330 MB and about 15–25× slower. |
| Multilingual middle | Skip for now | `multilingual-e5-small` has no English win and we have no non-English data to justify it. |

## Threshold re-sweep for bge

The six cosine thresholds are absolute and tuned to MiniLM's score range. bge scores everything higher (median digest pair 0.36 under MiniLM, 0.59 under bge), so each was swept again with the existing deterministic probes. Probe copies with model, pooling and query-prefix overrides: `.scratch/embedder-probe/sweeps/` (untracked); calibration script `.scratch/embedder-probe/calib.mjs`.

| Threshold | Today (MiniLM) | bge | Evidence |
|---|---|---|---|
| `SEMANTIC_LORE_THRESHOLD` ([semanticDictionary.ts:29](../../../src/lib/semanticDictionary.ts:29)) | 0.39 | **0.61** | bge 0.61: 89% precision / 70% recall (imported), 100% / 57% (authored). Matches MiniLM at 0.40 (89% / 70%). |
| `REHYDRATE_SIM_THRESHOLD` ([semanticRehydration.ts:18](../../../src/lib/semanticRehydration.ts:18)) | 0.35 | inert at 0.35 | Every bge score clears 0.35; the margin does the work. Raise only if a floor is still wanted. |
| `REHYDRATE_MARGIN` | 0.15 | **0.15 (keep)** | Bare action: 4/5 return hits, **4/4** charged scenes clean. MiniLM: 4/5 and 3/4. Same with or without the prefix. |
| `REHYDRATE_DUP_THRESHOLD` | 0.75 | **0.84** | Mapped by percentile over 4,950 real digest pairs: MiniLM ≥ 0.75 is the top 0.51%; bge's value there is 0.837. |
| `DIARY_DUP_THRESHOLD` ([semanticDiary.ts:29](../../../src/lib/semanticDiary.ts:29)) | 0.75 | **0.84** | Same mapping. UNVERIFIED on diary-shaped text. |
| `DIARY_SIM_THRESHOLD` ([semanticDiary.ts:24](../../../src/lib/semanticDiary.ts:24)) | 0.34 | 🚫 **none works** | Best bge floor: 50% precision / 60% recall (0.58–0.60). A median-plus-margin rule peaks at 50% too. Without the prefix: same. MiniLM: 100% / 60% at 0.34. |

Why diary fails: negatives score as high as positives under bge (an off-topic shopping action scores 0.66 against the weapon entry). Rank is still fine (R@1 4/5); the absolute score is not. arctic-s fails the same way (50% at best); mxbai-xs behaves like MiniLM (100% / 40% at 0.34). The diary fixture is small (8 actions, 5 positives), and the MiniLM threshold was already noted as fragile ("the margin is a hundredth").

### Style hypothesis: refuted

Hypothesis: shared first-person register ("I…", "today") drives bge's diary scores. Test (`.scratch/embedder-probe/diary-style.mjs`): strip first-person words, or keep content words only, on both sides. Threshold-free metric: pooled AUC of the 5 expected pairs against the 59 others.

| Model | Original | No first person | Content words | Lore (control) |
|---|---|---|---|---|
| MiniLM | AUC 0.96 · P@R60 100% | 0.89 · 100% | 0.88 · 38% | 0.99 · 88% |
| bge | AUC 0.94 · P@R60 50% | 0.92 · 38% | 0.80 · 27% | 0.98 · 93% |

Stripping the voice made both models worse, not bge better. Overall separation is nearly equal (AUC 0.94 vs 0.96). The top bge negatives are topical near-misses, not voice matches: salt haggling → the miscount entry (0.63), clouds over the marsh → the home-marshes song (0.62). bge scores shared topic and shared words high, as a retrieval model should. The diary positives are thematic analogies (repaying ↔ lending coppers), which bge scores no higher than those neighbors.

**The real limit is the fixture.** With 5 positives, precision turns on one or two pairs. MiniLM's 100% at 0.34 also rests on one pair: its best negative is 0.33, against a 0.34 positive. Neither verdict is firm until the diary fixture grows.

The enriched-query arm (action + narration tail) stays rejected under bge too: at margin 0.15 it fires nothing.

## Live model facts (Hugging Face API, 2026-11-06)

Download = ONNX weights + `tokenizer.json`.

| Model | Weights (dtype) | Tokenizer | Max tokens | Dim | Pooling / prefix |
|---|---|---|---|---|---|
| all-MiniLM-L6-v2 (today) | 23.0 MB (q8) | 0.7 MB | 512 tokenizer, **256 trained** (`max_seq_length`) | 384 | mean, none |
| bge-small-en-v1.5 | 34.0 MB (q8) | 0.7 MB | 512 | 384 | **CLS**; query prefix `Represent this sentence for searching relevant passages: ` |
| snowflake-arctic-embed-s | 34.0 MB (q8) | 0.7 MB | 512 | 384 | CLS; same query prefix |
| mxbai-embed-xsmall-v1 | 24.4 MB (q8) | 0.7 MB | 512 (4096 positions) | 384 | mean, none |
| multilingual-e5-small | 118.3 MB (q8) | 17.1 MB | 512 | 384 | mean; `query: ` / `passage: ` |
| embeddinggemma-300m | 196.7 MB (q4) · 308.9 MB (q8) · 175.4 MB (q4f16) | 20.3 MB | 2048 | 768 (MRL to 128) | model outputs `sentence_embedding`; `task: search result \| query: ` / `title: none \| text: ` |
| Qwen3-Embedding-0.6B | 567.5 MB (q4f16) · 613.5 MB (q8) | — | — | — | not probed |

- 🚫 **embeddinggemma q4f16 is not usable.** Its model card says the activations do not support fp16 and lists `fp32`, `q8`, `q4` only. The real floor is q4 at about 217 MB with tokenizer.
- The input limit does not bind today. Real digests average about 300 characters (roughly 70 tokens).
- Qwen3 0.6B was ruled out on size alone.

## Probe

Embedding-only, deterministic, no LLM. Each case ranks a target among candidates by cosine. Node CPU (onnxruntime-node), not browser WASM. Script: `.scratch/embedder-probe/probe.mjs` (untracked), results in `.scratch/embedder-probe/results.json`.

Case sets:
- **real-oblique (12):** the real failures from the 50-turn A/B (`semQB-*` dumps). Oblique actions ("I go through my pack…" → compass digest) against the 43–49 band digests. This is the failure mode that blocks default-on.
- **real-save (111):** two real player saves. Each player action ranks its own turn's digest among all digests in the save (99 + 12 cases). Measures action-to-memory alignment on real prose.
- **fixtures (35):** the existing labeled sets (band, recall-margin, diary, lore).

### Results

R@12 matches the Memory Cap of 12.

| Model | Oblique R@12 | Oblique MRR | Real save (99) MRR | Real save R@12 | Fixtures R@1 (34) |
|---|---|---|---|---|---|
| MiniLM (today) | 6/12 | 0.200 | 0.577 | 81/99 | 25 |
| **bge-small** | **9/12** | 0.350 | 0.604 | 83/99 | 26 |
| arctic-s | 8/12 | 0.302 | 0.649 | 90/99 | 26 |
| mxbai-xs | 6/12 | 0.229 | 0.594 | 82/99 | 25 |
| me5-small | 9/12 | 0.261 | 0.616 | 85/99 | 22 |
| **embeddinggemma q4** | 7/12 | **0.405** | **0.723** | 89/99 | **29** |
| embeddinggemma q8 | 7/12 | 0.391 | 0.723 | 89/99 | 29 |

Paired against MiniLM, case by case (wins / losses / ties):

| Model | Oblique | Real save | Fixtures |
|---|---|---|---|
| bge-small | **9 / 0 / 3** | 34 / 30 / 47 | 5 / 4 / 25 |
| arctic-s | 8 / 4 / 0 | 32 / 26 / 53 | 5 / 5 / 24 |
| mxbai-xs | 4 / 2 / 6 | 22 / 17 / 72 | 3 / 2 / 29 |
| me5-small | 8 / 2 / 2 | 34 / 32 / 45 | 3 / 6 / 25 |
| embeddinggemma q4 | 8 / 3 / 1 | **44 / 16 / 51** | 7 / 3 / 24 |

Prefix check: without their query prefix, bge stays level, but arctic loses clearly (real save MRR 0.649 → 0.510, fixtures 3 W / 11 L). The prefix must ship with either model.

### Speed (Node CPU, default threads; browser WASM is single-thread and slower)

| Model | Load (cached) | Per text |
|---|---|---|
| MiniLM | 0.1 s | 1.5 ms |
| bge-small / arctic-s | 2–3 s | 2.0 ms |
| me5-small | 8 s | 3.3 ms |
| embeddinggemma q8 | 18 s | 23 ms |
| embeddinggemma q4 | 12 s | 40 ms |

q4 is smaller but slower than q8 on CPU. On a phone, a backfill of a 100-turn save is seconds for bge and likely a minute or more for embeddinggemma. UNVERIFIED: not measured in a browser or on Android.

## Reading

- **bge-small is the default upgrade.** It never lost an oblique case and lifts cap-12 recall from 6/12 to 9/12. Elsewhere it is level with MiniLM. arctic-s is stronger on the real save but loses 4 oblique cases and needs its prefix to stay level. mxbai-xs is a tie with MiniLM.
- **embeddinggemma is the best general embedder here, not an oblique-recall fix.** Its gain is in R@1 and R@3. Three compass cases stay at rank 25–33 under every model: an inference gap, not a scoring gap, as the T6 notes found.
- None of the candidates closes the oblique gap. The best is 9/12 at cap 12, so the default-on question stays open.

## Limits

- One real save carries the save set (99 of 111 cases); the second has 12 turns. Both English.
- Multilingual quality was not tested. There is no non-English save to test on.
- Ranks only. Thresholds and narration impact are not measured; the threshold re-sweep and a live A/B come before any switch.
- The band fixture's `control-generic` case has no target and was excluded.

## Build cost when picked

- bge-small: change `EMBEDDING_MODEL_ID` ([memoryRelevance.ts:12](../../../src/lib/memoryRelevance.ts:12)), switch pooling to `cls` in [embeddingWorker.ts](../../../src/lib/embeddingWorker.ts), and add the query prefix on query-side calls only. The worker protocol needs a query/document flag. The cache key already re-embeds through backfill.
- embeddinggemma: a second load path (`AutoModel` + `AutoTokenizer`, read `sentence_embedding`), both prefixes, a per-model threshold set, and an Android memory check. The quality setting needs its own download UI (about 220–330 MB).
