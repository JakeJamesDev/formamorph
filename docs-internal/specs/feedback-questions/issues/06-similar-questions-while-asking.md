# 06: Similar Questions While Asking

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: the client spec (Duplicate check, Thread pane in the dialog)

Model rationale: async search with stale-response handling, and a second pane in a dialog that keeps its draft.

## What to build

While a player types a new question's title, the dialog lists **Similar Questions** under the title field. Selecting one swaps the form for the thread view inside the dialog, where the player can read, reply and vote. **Back** returns to the draft with its text. This works wherever the dialog opens.

## Acceptance criteria

- [ ] The list shows for questions only, once the title has a few characters, after a short debounce.
- [ ] The request sends `type=question`, `scope=all`, no status filter and a small limit.
- [ ] A response that resolves after unmount or after a newer keystroke is dropped.
- [ ] Selecting a result shows the existing thread view in the dialog with **Back** above it. Voting and replying work there.
- [ ] Back restores the form with the draft unchanged.
- [ ] The dev route for the question form shows the list through ticket 04's stub.
- [ ] Each guard is proven by removing it once and watching its test fail: the list on a suggestion, a stale response overwriting a newer one.
- [ ] Frames: `.scratch/frames/similar-questions-light.png` and `.scratch/frames/similar-questions-dark.png`, the form with results at desktop width; `.scratch/frames/similar-questions-pane.png`, the thread pane.

For you: whether the matches are useful on real questions once the server is live.
