# 07: Ask the Community from Help

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: formamorph
Spec: the client spec (Feedback opener, Replace-draft confirm, Layering above the help window, Sign-in and community gates, Button placement)

Model rationale: the help window's shielded layer sits above dialogs, and focus moves across layers. Three chat styles each render answers differently.

## What to build

Every finished Formaquestion answer shows **Ask the Community**. It opens the Feedback dialog above the help window on a new question, with the title filled in from the player's question. If the player has an unsent draft, the dialog asks before replacing it. Signed out, the button asks the player to sign in. With the community feature off, the button is hidden.

## Acceptance criteria

- [ ] The bug-report store becomes a feedback opener with state `{ open, type, fill }`. The error-details host and the bug report host use it, and the host passes the type to the dialog.
- [ ] A fill over a draft with text asks first: **Replace** takes the fill, **Keep Draft** opens on the draft. An empty draft takes the fill at once. Error reports follow the same rule.
- [ ] The button renders in the ask panel, the minimal chat and the bubble chat, once the answer is done, stopped, no AI or failed. It hides while writing. The footer row renders whenever the button shows.
- [ ] The title is the exchange's question with whitespace collapsed, cut to the title limit.
- [ ] Signed out, the button calls `requestSignIn`. With the community flag off, it is hidden.
- [ ] Opening the dialog sets Formaquestion's `covered`, so the dialog draws above the help window. Focus returns to the help window on close.
- [ ] Each guard is proven by removing it once and watching its test fail: the button with the flag off, `covered` while the dialog is open, a fill over a non-empty draft.
- [ ] Frames: `.scratch/frames/ask-community-light.png` and `.scratch/frames/ask-community-dark.png`, the dialog over the help window in a game at desktop width; `.scratch/frames/ask-community-button.png`, the button under an answer in each chat style.
- [ ] The help doc describes the button. The changelog fragment folds into ticket 04's entry.

For you: the button's place under an answer in each chat style, and the dialog over the help window in the editor.
