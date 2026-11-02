# 03: Text to Phonemes

Status: ready-for-human
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The core of the effort and the one test seam. Browser model load and per-word speed are unmeasured, so measure them early.

## What to build

American voices speak through the new pipeline. One deep module takes text and a voice's accent and returns the phoneme string. Each word takes the first source that has it: word table, CMUdict, compound split, then the model.

- The word table starts with the 20 accepted entries in the ear test record. It is plain data.
- A compound splits into two parts of at least 3 letters, both in CMUdict, and the second part takes secondary stress. The common-word list comes from CMUdict, because the trial's WikiPron list cannot ship. Check this list for false splits: the trial split Archon as arc + hon, and it passed by chance.
- Text cleanup handles numbers, abbreviations, and initialisms, which eSpeak did on its own.
- The model file ships in web, desktop, and Android builds, and it loads on first Text to Speech use.
- For a word with several CMUdict variants, use the first one here. Ticket 04 adds the picks.
- British voices keep using the old phoneme step here. Ticket 05 moves them.

Rulings: Q5, Q9, Q12, Q15. Spec sections: Text to phonemes, Text cleanup, Compound split, Model, Word table, Loading.

## Acceptance criteria

- [x] On the seam: a word table entry beats CMUdict, CMUdict beats a split, and a split beats the model. Each case fails when its branch is removed. `textToPhonemes.test.ts`, "lookup order". Removing the table, CMUdict, and split branches failed 6, 12, and 6 tests, and a comment-only control failed 0.
- [x] On the seam: words that must not split stay whole, and Emberwatch splits. "compound split": Archon, Haldren, Tiamat, and Nyxara go to the model. Dropping the common list failed 5 tests.
- [x] On the seam: numbers, common abbreviations, and initialisms produce spoken phonemes. "text cleanup", with 20 further mutations across cleanup, weak forms, and endings each failing a test.
- [x] A test proves every word table entry uses only symbols Kokoro accepts. "Kokoro notation", against the symbols in the Kokoro `tokenizer.json`.
- [x] The known-word and unknown-word scores are quoted, each within 0.5 points of eSpeak's 1.9 and 16.0. `scoreCli.mjs --module testing/g2p/pipeline.ts`, splits on: **known 92.6% exact, 1.9 error; unknown 38.6% exact, 14.9 error**.
- [x] Model load time and time per unknown word are measured in the preview and quoted. In headless Chromium over a production build, because the Browser pane had no free dev-server slot: dictionary 158 ms, **model load plus first word 541 ms, 21 ms median per unknown word**, 33 ms at most. In Electron: 171 ms, 570 ms, 23 ms, 39 ms. One clip also generated in Chromium through `KokoroClient`: 3.5 s of audio, peak 0.45.
- [x] The model file loads with no network in the desktop build's file layout. How it was checked is quoted. A throwaway Electron app served a production build through a copy of the `app://` mapping in `electron/main.cjs`, with network emulation offline and every request logged: 16 requests, 0 outside the build, and the dictionary, both model files, and the ONNX runtime all loaded.
- [x] The main bundle does not contain the module or model. A build output read confirms it. `vite build`: table strings and the `cmudict` and `encoder.fp16` paths appear only in `assets/TTSModal-*.js`, not in `index-*.js`.
- [x] A changelog fragment is added. `docs-internal/changelog.d/espeak-ng-replacement-03.md`.

For you: a rating page for clips whose phoneme string changed since your last pass. The strange words must reach at least 30 of 40 and the fantasy words at least 80 of 97.

## Landed

Built on rulings Q17 to Q20.

- **Q17:** on the unknown set about 218 words split, and the score above has splits on. Remaining false splits, such as agna + thous, wait for a word table entry when one is heard.
- **Q19:** 29 unknown-set words and 112 known-set words take a regular ending, and strange and fantasy take none. A read of all of them found no false stem.
- **Q20, carried tally:** strange 32 acceptable, 2 rejected, 6 unrated. Fantasy 89 acceptable, 0 rejected, 8 unrated. Both bars are already met on carried ratings.
- **Size:** the dictionary adds 3,618,488 bytes and the model 7,988,091 bytes to each build, loaded on first American use. The ONNX runtime files were already in the build.

For the next tickets:

- `phonemize(text, accent)` in `phonemeStep.ts` is the entry that takes the accent. `createTextToPhonemes` is American only, so Ticket 05 adds the accent at its seam.
- `wasmPaths` now points at the bundled runtime for the whole page, so Kokoro's runtime no longer comes from the CDN.

**Not verified**

- Nothing in the criteria beyond the note on where the speed was measured. The modal itself was not opened, because the Browser pane had no free slot.
- The Android build and a packaged desktop build did not run. Both ship the same `dist` files.

**Known limits**

- A dotted initialism keeps its period only at the end of the text, so "the U.S. She left" loses that pause.
- "St." after a capitalized word at a sentence start reads as Street. Roman numerals read as letters or words.

**For you**

- Rate `.scratch/espeak-ng-replacement-03/frames/rating-strange/index.html` (6 clips) and `.scratch/espeak-ng-replacement-03/frames/rating-fantasy/index.html` (8 clips), then merge with `testing/g2p/ratingPage.ts merge`. The strange words must reach at least 30 of 40 and the fantasy words at least 80 of 97.
- Listen to `.scratch/espeak-ng-replacement-03/frames/rating-sentences/index.html` (6 clips) for weak forms in whole sentences. No bar applies.
- Archon no longer splits, so its new string `ˈɑɹʧən` is on the strange page.
