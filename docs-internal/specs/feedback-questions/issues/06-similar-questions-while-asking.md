# 06: Similar Questions While Asking

Status: done
Blocked by: 03, 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: the client spec (Duplicate check, Thread pane in the dialog)

Model rationale: async search with stale-response handling, and a second pane in a dialog that keeps its draft.

## What to build

While a player types a new question's title, the dialog lists **Similar Questions** under the title field. Selecting one swaps the form for the thread view inside the dialog, where the player can read, reply and vote. **Back** returns to the draft with its text. This works wherever the dialog opens.

## Acceptance criteria

- [x] The list shows for questions only, once the title has a few characters, after a short debounce. Tests "searches every question…" (3+ characters, 300 ms) and "never searches for a bug or a suggestion".
- [x] The request sends `type=question`, `scope=all`, no status filter and a small limit. Exact `toHaveBeenCalledWith` in "searches every question…" (limit 5, no sort).
- [x] A response that resolves after unmount or after a newer keystroke is dropped. Tests "drops a response that arrives after a newer keystroke" and "sends nothing once the dialog unmounts mid-pause"; the post-resolve unmount check is by inspection (see Not verified).
- [x] Selecting a result shows the existing thread view in the dialog with **Back** above it. Voting and replying work there. Test "opens a match in the dialog…" (`setVote`, `comment` calls) and the pane frame.
- [x] Back restores the form with the draft unchanged. Same test (title and body read back), and a DOM read on the dev route.
- [x] The dev route for the question form shows the list through ticket 04's stub. `#dev?modal=feedbackForm&tab=question&fixture=feedback`; the stub now searches by words as the server does.
- [x] Each guard is proven by removing it once and watching its test fail: the list on a suggestion, a stale response overwriting a newer one. Each mutation failed only its own test; the debounce `clearTimeout` too.
- [x] Frames: `.scratch/frames/similar-questions-light.png` and `.scratch/frames/similar-questions-dark.png`, the form with results at desktop width; `.scratch/frames/similar-questions-pane.png`, the thread pane.

## Landed

**Not verified**

- A request that starts and then resolves after unmount: the `mounted` check has no test, because React 18 ignores that `setState` without a sign a test can read.

**For you**

- For you: whether the matches are useful on real questions once the server is live.
- The row look in the frames: `.scratch/feedback-questions-06/frames/similar-questions-light.png`, `similar-questions-dark.png`, `similar-questions-pane.png`.
