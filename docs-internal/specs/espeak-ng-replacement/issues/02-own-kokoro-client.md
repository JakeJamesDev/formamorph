# 02: Own Kokoro Client

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A contained prefactor. Text to Speech uses two calls of `kokoro-js`, so the client stays small. The care is in matching its chunking and voice loading.

## What to build

Text to Speech runs through a small client of our own on `@huggingface/transformers`, with the same two calls: load the model, and generate from text with a voice and speed. Phonemes still come from `phonemizer`, behind one replaceable step, so players hear no change.

This ticket owns the client and that step's shape. Ticket 03 fills the step with the new pipeline. `kokoro-js` is Apache-2.0, so anything adapted from it keeps its notice. Removing the packages is Ticket 06.

The client stays in the lazy chunk. Check the comment at the first-use load in the Game Viewer, and keep it true.

Rulings: Q1. Spec section: Kokoro client.

## Acceptance criteria

- [x] No source file outside the client's one phoneme step imports `kokoro-js` or `phonemizer`. Source grep: only `src/lib/tts/phonemeStep.ts` imports `phonemizer`; `kokoro-js` appears only in `src/notes/*.md` prose.
- [x] For a fixed text set in both voice accents, the client produces the same token ids as `kokoro-js`. The set and the result are quoted. Throwaway script (deleted, no snapshot committed per the spec session) fed both clients the same tokenizer and a capturing model: 12 of 12 id sequences identical. Voices `af_heart` and `bf_emma`; texts:
  - "Hello there, traveler. The road to Emberwatch is long."
  - "Dr. Smith paid $4.50 at 3:05 on March 5, 1999."
  - "She said, \"Yeah, it's 2,500 miles—etc. Mr. Jones isn't coming.\""
  - "The U.S.A. won 3-2 in the 1980s; 12.75 percent agreed."
  - "Nineteen ninety-nine, ninety, and a hundred knights drew their swords (quietly)."
  - "Kokoro reads the colour of the harbour near the castle's gate."
- [x] Voice list, speed, and long text splitting match the current behavior, tested through the Text to Speech test seam. `kokoroClient.test.ts` (28 voices, accent per voice, default speed, passed speed, style row clamps 0 and 509) and `kokoroVoiceLoading.test.ts` (fetch once, browser cache hit, failed download); long text splitting is unchanged `ttsChunks.test.ts` (30 tests), and the modal's `splitForTTS` path is untouched. The failed-download guard was mutation-checked.
- [x] The main bundle does not contain the client. A build output read confirms it. `vite build`: the strings `Kokoro-82M-v1.0-ONNX` and `kokoro-voices` appear only in `assets/TTSModal-*.js`, not in `index-*.js`.
- [x] The model loads and a clip generates in the preview, through the Text to Speech dev route. `#dev?view=gameViewer&fixture=whiteRoom&modal=tts`: Load Model, then Start produced 8 clips at 24 kHz (4.6 to 7.1 s each).

For you: one clip in an American voice and one in a British voice in Text to Speech, to confirm they sound the same as before.

## Landed

**Not verified**
- Sound parity by ear: the clips were measured, not listened to.
- Long-text splitting through the modal: no new test; the path is untouched and covered by `ttsChunks.test.ts`.

**For you**
- Play one American voice and one British voice in Text to Speech, to confirm they sound the same as before. Open Text to Speech in a game, or `#dev?view=gameViewer&fixture=whiteRoom&modal=tts`.
- The new `tts` dev modal needed a surface route, a label, a `surfaceMap` entry mapped to "How to Read a Turn Aloud", and `surface="tts"` on the dialog, because the surface tests require them for any dev modal.
- The client adds one guard `kokoro-js` lacked: a failed voice download throws instead of loading the error body as voice data.
