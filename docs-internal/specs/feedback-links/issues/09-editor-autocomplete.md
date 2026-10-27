# 09: Editor Autocomplete

Status: ready-for-agent
Blocked by: 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q12, Q15, Q17)

## What to build

In the feedback body and comment editors, in the app and on the website, typing `@` suggests players and typing `#` suggests threads. Picking a suggestion inserts `@username` or `#N`. It builds on the existing suggestion list and keyboard handling.

## Acceptance criteria

- [ ] Typing `@` then letters lists thread participants first, then other prefix matches.
- [ ] Typing `#` then digits or words lists readable threads by number or title. On the website the request passes the Votable boards as its `type` filter, so no bug is listed (spec Q31).
- [ ] Arrow keys move, Enter picks, Escape closes without inserting. A click picks too.
- [ ] No suggestions open inside a code span or code block.
- [ ] Requests are debounced, and a late response after unmount or a newer query is dropped.
- [ ] The wiki's feedback section mentions the suggestions.
- [ ] Frames of both lists open, light and dark: `.scratch/frames/autocomplete-<kind>-<theme>.png`.

For you: type a few mentions and thread links in a real comment and judge whether the suggestions feel quick.
