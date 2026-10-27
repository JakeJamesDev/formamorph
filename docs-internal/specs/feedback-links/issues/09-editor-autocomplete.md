# 09: Editor Autocomplete

Status: done
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q12, Q15, Q17)

## What to build

In the feedback body and comment editors, in the app and on the website, typing `@` suggests players and typing `#` suggests threads. Picking a suggestion inserts `@username` or `#N`. It builds on the existing suggestion list and keyboard handling.

## Acceptance criteria

- [x] Typing `@` then letters lists thread participants first, then other prefix matches. (FeedbackSuggestPlugin.test "lists participants first…", "searches everyone once letters follow a bare @…"; order is the server's)
- [x] Typing `#` then digits or words lists readable threads by number or title. On the website the request passes the Votable boards as its `types` filter, so no bug is listed (spec Q31). (FeedbackThreadView.suggest.test "searches only the Votable boards on the website" / "every board in the app")
- [x] Arrow keys move, Enter picks, Escape closes without inserting. A click picks too. (FeedbackSuggestPlugin.test: arrows + Enter, Escape incl. inside a Radix dialog and before the list shows, mouse pick)
- [x] No suggestions open inside a code span or code block. (feedbackSuggest.test cases + plugin "opens nothing inside a code span"; code mask shared with the link parser)
- [x] Requests are debounced, and a late response after unmount or a newer query is dropped. (plugin tests "debounces…", "drops a response that a newer query overtook", "aborts the request in flight at unmount"; each guard mutation-tested red)
- [x] The wiki's feedback section mentions the suggestions. (docs/Community-Creations.md "Suggestions While You Type")
- [x] Frames of both lists open, light and dark: `.scratch/frames/autocomplete-<kind>-<theme>.png`. (dev route `modal=feedbackThread&fixture=feedback`, reply box)

For you: type a few mentions and thread links in a real comment and judge whether the suggestions feel quick.

## Landed

**Not verified**
- Frames were taken before the list's gap under the caret grew by 4 px (the shared `caretMenuPosition`); the Browser pane was hidden for a retake.
- Against the live server: tests and frames use mocks and the dev stub.

**For you**
- Type a few mentions and thread links in a real comment and judge whether the suggestions feel quick.
- Frames: `.scratch/feedback-links-09/frames/autocomplete-user-dark.png`, `…-user-light.png`, `…-thread-dark.png`, `…-thread-light.png`.
- Approve the row look (avatar + name; muted `#N` + title), which follows the Q35 labels still waiting on you.
