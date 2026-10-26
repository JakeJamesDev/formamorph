# 07: Ask the Community from Help

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Repo: formamorph
Spec: the client spec (Feedback opener, Replace-draft confirm, Layering above the help window, Sign-in and community gates, Button placement)

Model rationale: the help window's shielded layer sits above dialogs, and focus moves across layers. Three chat styles each render answers differently.

## What to build

Every finished Formaquestion answer shows **Ask the Community**. It opens the Feedback dialog above the help window on a new question, with the title filled in from the player's question. If the player has an unsent draft, the dialog asks before replacing it. Signed out, the button asks the player to sign in. With the community feature off, the button is hidden.

## Acceptance criteria

- [x] The bug-report store becomes a feedback opener with state `{ open, type, fill }`. The error-details host and the bug report host use it, and the host passes the type to the dialog. Verified: `src/lib/feedbackOpener.ts` holds `{ open, type, fill, opener }`; ErrorDetailsReportBug tests pass through `FeedbackHost`.
- [x] A fill over a draft with text asks first: **Replace** takes the fill, **Keep Draft** opens on the draft. An empty draft takes the fill at once. Error reports follow the same rule. Verified: FeedbackDialog.test "a fill over a draft" (Replace, Keep Draft, empty draft, same fill skips); ErrorDetailsReportBug "asks before it replaces".
- [x] The button renders in the ask panel, the minimal chat and the bubble chat, once the answer is done, stopped, no AI or failed. It hides while writing. The footer row renders whenever the button shows. Verified: askCommunity tests for the ask panel, minimal, bubble strip, stopped, failed, and hidden while writing. No AI shares the `status !== 'writing'` check and has no test of its own.
- [x] The title is the exchange's question with whitespace collapsed, cut to the title limit. Verified: `questionFromHelp` unit tests; askCommunity test types a double-spaced question; Playwright read the title in Chromium.
- [x] Signed out, the button calls `requestSignIn`. With the community flag off, it is hidden. Verified: askCommunity "asks a signed-out player to sign in first" and "is hidden with the community flag off".
- [x] Opening the dialog sets Formaquestion's `covered`, so the dialog draws above the help window. Focus returns to the help window on close. Verified: askCommunity "opens a new question over the window" (layer z 40 and inert, focus back on the button); Playwright read z 40 and inert in Chromium.
- [x] Each guard is proven by removing it once and watching its test fail: the button with the flag off, `covered` while the dialog is open, a fill over a non-empty draft. Verified: each guard mutated once (flag check, `feedbackOpen` in `covered`, draft over fill, focus return); the matching test went red, then the code was restored.
- [x] Frames: `.scratch/frames/ask-community-light.png` and `.scratch/frames/ask-community-dark.png`, the dialog over the help window in a game at desktop width; `.scratch/frames/ask-community-button.png`, the button under an answer in each chat style. Verified: frames taken by Playwright at 1440×900 in a White Room game.
- [x] The help doc describes the button. The changelog fragment folds into ticket 04's entry. Help doc: "How to Ask the Community" in docs/Formaquestion.md. No fragment by ruling; the spec session folds the line into 04's entry at close.

For you: the button's place under an answer in each chat style, and the dialog over the help window in the editor.

## Landed

**Not verified**
- The dialog over the help window in the World Editor was not opened live. The cover and the host are the same in every view.
- An image-only question, which opens with no fill, is covered by a unit test only (`questionFromHelp` returns null).

**For you**
- For you: the button's place under an answer in each chat style, and the dialog over the help window in the editor.
- Frames: `.scratch/feedback-questions-07/frames/ask-community-button.png`, `.scratch/feedback-questions-07/frames/ask-community-light.png`, `.scratch/feedback-questions-07/frames/ask-community-dark.png`.
- Built beyond the ticket by ruling: the help window also sinks while sign-in is up; the confirm skips when the draft already equals the fill; the confirm carries "This deletes your unsent draft."
