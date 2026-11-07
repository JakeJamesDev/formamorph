# 05: Local Model Move

Status: ready-for-agent
Blocked by: 02, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: the existing model move module already never overwrites. This ticket adds an order and wires it into the merge run.

## What to build

The merge moves local models from the AppData profile's models directory into the folder's models directory, as the last category (Q6, Q14).

- The source is AppData's own model directory: its model-folder choice, else its default models folder. The destination is the folder's model directory after ticket 04's merge.
- The move is skipped when source and destination are the same folder.
- A file the folder already has stays, and the AppData file is left alone. The model move module already behaves this way.
- Files move smallest first. The run shows bytes moved against the total. Skipped files and their reasons appear in the result screen.
- An interrupted move is offered again on the next start (Q8). Files already moved are gone from the source and are not counted again.

## Acceptance criteria

- [ ] Temp-folder tests: smallest-first order; an existing destination file stays on both sides; the move is skipped when source and destination are the same.
- [ ] A test fails when the smallest-first sort is removed.
- [ ] The result screen lists skipped models with reasons (DOM read on the dev-route).
- [ ] The engine places local models after every other category.
- [ ] A changelog fragment covers local models.

For you: merge a profile that holds a multi-GB model across drives and watch the progress bar.
