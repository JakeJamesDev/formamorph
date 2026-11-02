# Phoneme Model: Training and Scoring

Text to Speech turns a word it has never seen into phonemes with a small model of our own. This folder rebuilds that model and scores any pipeline against the bar. eSpeak NG is not needed for either.

## 📌 What is pinned

| Thing | Where |
|---|---|
| CMUdict revision, sha256, seed | [`pins.json`](pins.json) |
| CMUdict file and license | [`cmudict.dict`](../../src/lib/tts/g2p/cmudict.dict), [`CMUDICT-LICENSE`](../../src/lib/tts/g2p/CMUDICT-LICENSE) |
| CMUdict to Kokoro mapping, flaps included | [`arpabet.json`](../../src/lib/tts/arpabet.json), read by [`arpabet.ts`](../../src/lib/tts/arpabet.ts) |
| WikiPron revision, for scoring only | [`pins.json`](pins.json) |
| Exported model | [`src/lib/tts/g2p/`](../../src/lib/tts/g2p/) |

## 🧠 Rebuild the model

Training takes about 70 minutes and holds the GPU. Run it when nobody needs the machine.

```bash
python -m venv .scratch/g2p/venv
.scratch/g2p/venv/Scripts/python -m pip install -r testing/g2p/requirements.txt
npx vite-node testing/g2p/writePairs.ts .scratch/g2p/pairs.json
.scratch/g2p/venv/Scripts/python testing/g2p/train.py .scratch/g2p/pairs.json .scratch/g2p/model
.scratch/g2p/venv/Scripts/python testing/g2p/export_onnx.py .scratch/g2p/model src/lib/tts/g2p .scratch/g2p/pred
```

- Training reads only the pairs file, and that file comes only from the pinned CMUdict. Primary entries only.
- A rerun repeats the seed and data split. It does not repeat the exact bytes.
- The export prints how many words differ between ONNX and PyTorch, and the file sizes.

Install PyTorch from its CUDA index first if the default build has no GPU support.

## 📏 Score a pipeline

```bash
node testing/g2p/scoreCli.mjs --predictions .scratch/g2p/pred/onnx-fp16.json
```

A pipeline is either `--predictions <word-to-phonemes.json>` or `--module <file>` whose default export is `async (word, accent) => phonemes`. A TypeScript module runs through `npx vite-node testing/g2p/scoreCli.mjs`. Add `--accent b` for British.

The script fetches WikiPron at run time, checks its git blob hash, and caches it under `node_modules`. WikiPron is CC BY-SA, so **nothing derived from its pronunciations is ever committed**.

The stored eSpeak numbers are in [`espeak-reference.json`](espeak-reference.json), with the method used to get them.

| Set | Words | Bar |
|---|---|---|
| [`unknown`](sets/unknown.json) | 1,500 words absent from CMUdict, `ipa-dict`, and Misaki | Phoneme error at most 0.5 above eSpeak |
| [`known`](sets/known.json) | Bundled world prose, with token counts | Phoneme error at most 0.5 above eSpeak |
| [`strange`](sets/strange.json) | 40 names and rare words | At least 30 of 40, by ear |
| [`fantasy`](sets/fantasy.json) | 97 common fantasy words | At least 80 of 97 and no fewer than 76, by ear |

The sets hold words only. WikiPron lists few of the strange words, so their error numbers mean little. The ear decides those sets.

## 👂 Rate by ear

```bash
npx vite-node testing/g2p/ratingPage.ts build fantasy .scratch/rating/fantasy new=.scratch/g2p/pred/onnx-fp16.json
npx vite-node testing/g2p/ratingPage.ts merge <downloaded ratings.json>
npx vite-node testing/g2p/ratingPage.ts tally fantasy new=.scratch/g2p/pred/onnx-fp16.json
```

- `build` makes a page of blind clips. Pass several `arm=file` pairs to compare, and the page never says which arm said what.
- A string already rated for that word is carried from [`ratings.json`](ratings.json), so you only hear what is new.
- Add `--accent b` for British voices. Those ratings are kept apart.
- The store holds only strings from our own pipeline. The full record of the first passes is in [`ear-test-strange-words.md`](../../docs-internal/specs/espeak-ng-replacement/ear-test-strange-words.md).
