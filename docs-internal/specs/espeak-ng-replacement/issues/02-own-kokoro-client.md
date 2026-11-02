# 02: Own Kokoro Client

Status: ready-for-agent
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

- [ ] No source file outside the client's one phoneme step imports `kokoro-js` or `phonemizer`.
- [ ] For a fixed text set in both voice accents, the client produces the same token ids as `kokoro-js`. The set and the result are quoted.
- [ ] Voice list, speed, and long text splitting match the current behavior, tested through the Text to Speech test seam.
- [ ] The main bundle does not contain the client. A build output read confirms it.
- [ ] The model loads and a clip generates in the preview, through the Text to Speech dev route.

For you: one clip in an American voice and one in a British voice in Text to Speech, to confirm they sound the same as before.
