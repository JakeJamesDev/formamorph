# 02: Coref Host and Mention Reading

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The two modules that turn a finished passage into a Mention Reading, with no UI yet.

- **Coref Host:** a worker built through `createWorkerClient`.
  - Input: one passage. Output: clusters as character spans.
  - It owns tokenization, the two-graph run, top-k pruning, the LingMess category masks for the big model, and cluster building. These come from the fastcoref host code that the Python evaluation used.
  - It builds against the graph contract in the scratch export. Ticket 01 keeps that contract.
- **onnxruntime-web version:** the bundled transformers.js copy is an older dev build, and 1.31.1 is the measured version. Decide between a direct dependency and moving the shared copy forward. Record the reason in the ticket.
- **Mention Reading:** a pure module, `(passage text, clusters, cast entities, scene context) → reading`.
  - The reading lists linked mentions (span, entity id) and quote speakers (quote span, entity id or none).
  - Cluster naming uses the existing entity matchers and follows the proved combination rules:
    - names come from parser hits that end a mention, distinctive head words, aliases and Stranger Name words;
    - a head that two cast members share names nobody;
    - one-word person names keep the capital guard;
    - "I'm <name>" ties to the speaker's "I".
  - Speaker attribution picks the mention at a speech verb attached to the quote. If there is none, it takes the nearest preceding subject mention in the paragraph. Otherwise the speaker is none.
- **Changelog:** no fragment, because nothing changes for the player.

## Acceptance criteria

- [x] Host test: recorded graph outputs from the Python reference stand in for the sessions. The clusters for real passages equal the Python clusters. `corefHost.test.ts`: 3 big (e120 int8w) and 4 small passages equal the Python clusters, ids, spans and category masks. The fixtures are passages written for them (Q33); real-narration parity is the browser check below (38/38).
- [x] The Mention Reading tests port the gold sets. With e120 clusters, the scores match or beat the evaluation: blind set names 75/81, descriptors 24/43, pronouns 110/136, traps 34/44, presence 27/29. `mentionReading.gold.test.ts` over the private gold sets: blind 75/81, 24/43, 110/136, 34/44, 27/29, equal to the evaluation. Hard: 15/16, 8/15, 40/50, traps 8/8, presence 9/11, also equal. Real: pronouns 119/153, traps 41/41, presence 18/25 (19/25 in the evaluation: ff-13 loses one cast member whose presence came only through a wrong "you" link; Q34). The scores are the same on the shipped int8w clusters.
- [x] A quote-speaker gold set exists, with at least 60 quotes from real narration. The ticket reports its score. `quotes.json` in the training-data repo: 73 quotes from the 13 real passages, 50 with a cast speaker. Score: **65/73, 0 wrong** (the 8 misses get no speaker; 7 are in passages that never name the speaker).
- [x] Each naming rule has a guard test, proved by reinstating its bug. `mentionReading.test.ts`; 19 reinstated bugs (naming rules, veto, player rule, the three speaker rules, host pruning, categories, segments, argmax) each fail a test.
- [x] A browser check outside the gates runs the host in Chrome on WebGPU and WASM with real graphs, and reports parity. Installed Chrome, RTX 4090, page not isolated (WASM on 1 thread). Against Python with optimizations off (see Notes):

  | Path | Passages identical | WebGPU median / max | WASM median / max |
  |---|---|---|---|
  | Big (e120 int8w) | 38/38 on both | 56 / 827 ms | 3.7 / 8.6 s |
  | Small (FCoref path, scratch weights) | 39/39 on both | 27 / 383 ms | 1.1 / 2.2 s |

## Notes

- **onnxruntime-web: moved the shared copy forward** to 1.31.1. It is a direct dependency, and an npm `overrides` entry gives transformers.js the same copy.
  - **Why not two runtimes:** a second copy would add a 29 MB WASM binary to every build.
  - **Why not leave transformers.js alone:** transformers.js and the TTS phoneme step already import the hoisted copy, and Vite's `onnxruntime-web-dist` alias serves the hoisted copy's WASM files. Two versions would mismatch the runtime code and its WASM.
  - **Checked on 1.31.1 in Chrome:** semantic-memory embeddings (related pair 0.577, unrelated 0.186), the phoneme step, and Kokoro on WebGPU (2 s of audio).
- **Word tokenization** replays spaCy `en_core_web_sm` (`spacyEnTokenizer.json`, from `scripts/coref/dump_spacy_tokenizer.py`): 0 differences over 472k tokens (gold passages plus 100 LitBank books). BPE equals the Hugging Face fast tokenizer on 551k ids.
- **Python's graph optimizer breaks int8w parity.** onnxruntime 1.32 with default optimizations rewrites the weight-only int8 MatMuls into a lossier path. With it, mention logits drift 6.28 from fp32, and the browser matches only 34/38 passages. With `ORT_DISABLE_ALL`, the drift is 4.16 and matches onnxruntime-node and Chrome exactly. The fixture recorder runs unoptimized; ticket 01 knows.
- **Small-model fixtures** run the FCoref host path over seeded random scores with wiped weights, so no OntoNotes numbers enter the repo. Random weights tie spans at the top-k cut, and torch leaves tie order undefined, so the recorder refuses a fixture with a tie at the cut.
- **Player (Q32, Q34):** "you", the player's name, and the narrator's own "I" never link and never speak. A speaker's "I" inside a quote still links ("I'm Mira"). This costs the real set one presence, 19→18: in ff-13 the e120 cluster merged the player's "you" into a cast member's. A word of the player's name that a cast member's name shares stays linkable.
- **Veto:** an everyday-word hit counts as backed when a cluster mention ends with it, as in the evaluation code the floors come from, not merely when a mention contains it.
- **Host config** carries an optional `maxDocLen` (fastcoref's `max_doc_len`: longer passages get no clusters, as fastcoref skips them). Absent means no limit; ticket 01's host-config file can add it.

## Landed

**Not verified**

- The gold-set test skips in the gates until the e120 gold-passage clusters are in the training-data repo (`coref/gold/preds/litbank-e120.json`). It ran green against a local copy of that layout.
- The small model's real weights do not exist yet (ticket 01). The small path is proven on the OntoNotes scratch graphs, which never ship.

**For you**

- Review and commit the 73 quote-speaker labels in `formamorph-training-data/coref/gold/quotes.json` (uncommitted there). Unnamed speakers were labeled with the cast member a later passage names.
- The speech-verb rules were tuned on that same set, so 65/73 is not a held-out score.
- Credits: the word tokenizer ships data derived from spaCy (MIT). Ticket 03 adds LitBank to Credits; spaCy's MIT notice belongs there too.
