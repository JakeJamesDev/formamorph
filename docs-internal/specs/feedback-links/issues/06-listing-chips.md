# 06: Listing Chips

Status: done
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q3, Q16)

## What to build

A pasted community listing URL in a feedback body or comment shows as a chip with the listing's title, kind and thumbnail, and opens the listing. A hidden, pending or deleted listing shows the unavailable chip. Works in the app and on the website.

## Acceptance criteria

- [x] The thread view in app mode and site mode renders a listing chip for a resolved target and the unavailable chip for an unavailable one. (`FeedbackThreadView.links.test.tsx`: "draws a pasted listing URL as a chip…", "follows the site route in place on the website")
- [x] Clicking a chip opens the listing in the app's community view and at the listing's route on the site. (Tests: `onOpenListing` called on a plain click; site href `/community/world/w1`. The app wiring in `MainMenu.handleOpenListing` and the site `navigateSite` call are not covered by a test.)
- [x] A listing URL inside code stays plain text. (Test: "keeps a listing URL plain inside code")
- [x] The wiki's feedback section explains listing links. (`docs/Community-Creations.md`, "Listing Links")
- [x] Frames, light and dark: `.scratch/frames/listing-chips-<theme>.png`. (Dev router `feedbackThread` on `fixture=feedback`; the stub now serves one visible and one taken-down listing.)

## Landed

**Not verified**
- A click in the app closing the Feedback window and opening the catalog on the listing: no test drives `MainMenu`. The close is one `setShowFeedback(false)` in the opener the catalog already uses.
- A click on the site: no test drives `navigateSite` through `FeedbackPage`.

**For you**
- Look at the listing chips in the dark and light frames: `.scratch/feedback-links-06/frames/listing-chips-dark.png` and `.scratch/feedback-links-06/frames/listing-chips-light.png`. Check the height and alignment against the ticket 01 frames, and the thumbnail slot (the frame shows a flat teal stand-in).
- In the app, select a listing chip in a thread: the Feedback window should close and the listing should open in Community Creations.
