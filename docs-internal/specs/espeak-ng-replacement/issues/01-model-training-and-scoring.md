# 01: Model Training and Scoring

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Heavy on judgment: this ticket holds the provenance record and freezes the bar. Trial scripts and weights are in `.scratch/espeak-ng-replacement/`, and they are a starting point only.

## What to build

Anyone can rebuild the phoneme model from the repo and score any pipeline against the bar, with no eSpeak installed.

- The training script lands with the pinned CMUdict revision, its license text, and the seed. It trains on primary CMUdict entries only, with the Q9 shape.
- This ticket owns the mapping from CMUdict to Kokoro notation, including flaps, as data that Ticket 03 reuses.
- A retrained model is exported to ONNX at half precision and committed, ready for Ticket 03 to load. The trial weights are not carried over.
- The frozen word sets land as words only: the 1,500 unknown words, the known-word set from bundled world prose, the 40 strange words, and the 97 fantasy words.
- eSpeak's numbers are stored as results while it is still installed, so the scoring script does not need it afterward. This includes British numbers for Ticket 05.
- The scoring script fetches WikiPron at run time. It commits nothing derived from WikiPron pronunciations.
- The rating page generator lands too: blind clips, with ratings carried for identical strings.

Ask the user for a GPU window before training. Do not start a run mid-session.

Rulings: Q5, Q6, Q9, Q11, Q13, Q16. Spec sections: Provenance, WikiPron.

## Acceptance criteria

- [x] Training reads only the pinned CMUdict revision, and the revision and seed are recorded in the repo. `testing/g2p/pins.json`: `cmusphinx/cmudict` 74790861 and seed 1234. `writePairs.ts` refuses a file whose sha256 differs, and `train.py` reads only its pairs. The file's hash is also a test in `arpabet.test.ts`.
- [x] No WikiPron pronunciation, Misaki data, or eSpeak output is committed, except eSpeak's stored scores. A search of the committed data confirms it. All 7,219 set entries match `^[A-Za-z']+$`. `espeak-reference.json` holds only numbers in `results`. Of the 160 strings in `ratings.json`, 0 equal a WikiPron string, 58 equal eSpeak's string for that word, and 60 equal a Misaki string. All 160 came from our CMUdict mapping, our CMUdict-only model, or the hand-written table, as read from the ear test record, so those are agreements on the same pronunciation, not copies. The ear test record itself is exempt by the spec session's ruling.
- [x] The ONNX model at half precision scores within 0.5 points of eSpeak's 16.0 phoneme error on the 1,500 unknown words. The number is quoted in the ticket. **14.6 phoneme error, 39.3% exact** against eSpeak's 16.0 and 35.8%, from `scoreCli.mjs` against the pinned WikiPron. This is the model alone, with no splits.
- [x] ONNX output is compared with the PyTorch output over the frozen sets, and the difference count is quoted. Over 6,464 distinct words, ONNX differs from PyTorch full precision on **2** (both unknown words) and from PyTorch half precision on 5.
- [x] The committed model's size and gzip size are quoted. Encoder 3,408,222 bytes plus decoder 4,579,869 bytes: **7,988,091 bytes total, 6,962,217 gzipped**. Spec session limit: about 8.5 MB.
- [x] The scoring script runs with `phonemizer` absent, and it reports exact and phoneme error for a given pipeline. Ran from a copy with an empty `node_modules`, where importing `phonemizer` gave `ERR_MODULE_NOT_FOUND`: same 39.3% and 14.6. `--module` also ran through `vite-node` with a TypeScript module.
- [x] A test proves the mapping handles stress, flaps, and diphthongs against known CMUdict entries. `src/lib/tts/arpabet.test.ts`, with 20 mutations across the mapping, scorer, and page each turning a test red.

## Landed

Stored eSpeak numbers, repeated from a pin that matches the trial's file byte for byte:

| Set | American exact / error | British exact / error |
|---|---|---|
| Unknown | 35.8% / 16.0 | 42.4% / 14.4 (1,332 words have references) |
| Known | 92.6% / 1.9 | 91.7% / 2.2 |
| Strange | 71.4% / 12.1 (14 words have references) | 71.4% / 12.6 |
| Fantasy | 65.2% / 9.3 | 64.4% / 8.7 |

For the next tickets:

- The model file pair, `vocab.json`, `cmudict.dict`, and its license are in `src/lib/tts/g2p/`. `arpabet.ts` exports `arpabetToKokoro` and `parseCmudictLine`.
- The graphs take `input_ids` and `attention_mask`, then `decoder_input_ids`, `encoder_hidden_states`, and `encoder_attention_mask`. There is no cache: run the decoder with the whole prefix at each step and read the last row. `onnxruntime-node` matched the Python output on 200 of 200 words at 17 ms per word. The browser is still Ticket 03's to measure.
- The model alone scores 3.4 on the known words. That is not the known-word bar, because CMUdict answers those words first in Ticket 03's pipeline.
- `scoreCli.mjs --accent` and a `--module` pipeline both use the voice accent, `a` or `b`.

**Not verified**

- Nothing in the criteria. The rating page's build ran with main's Ticket 02 client copied in for the run, since this branch sits behind it. A clip was byte-identical through `generate` with a pass-through phoneme step. Its first run on main is Ticket 03's page.

**For you**

- Nothing to hear yet. Ticket 03's rating page covers the listening bars. Tallied on carried ratings, this model alone stands at 29 acceptable, 4 rejected, and 7 unrated of the 40 strange words.
