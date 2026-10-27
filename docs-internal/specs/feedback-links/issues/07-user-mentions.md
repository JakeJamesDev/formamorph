# 07: User Mentions

Status: done
Blocked by: 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q1, Q8, Q9, Q18, Q23)

## What to build

`@username` in a feedback body or comment links to the player's profile in the app and on the website. A name with no account shows as "unknown user", with the typed name hidden. A post refused for the mention cap shows the server's message in the post's error place.

## Acceptance criteria

- [x] The thread view in app mode and site mode renders a user link for a resolved target and "unknown user" for an unavailable one, with the typed name absent from the DOM. Test: `FeedbackThreadView.links.test.tsx` "user links", app and website cases; DOM read in the preview.
- [x] Clicking a user link opens that profile in the app and at the profile route on the site. Test: plain click calls `openProfile(id, username)`, a ctrl-click leaves the browser's link; the site's provider (`FeedbackPage.tsx`) maps `openProfile` to `/u/<name>`, and its chips carry that `/u/<name>` href.
- [x] The editor shows the cap refusal and keeps the typed text. Test: `FeedbackMentionCap.test.tsx`, a real 400 through the service, for a reply, a comment edit, a new thread and a thread edit (Q37).
- [x] The wiki's feedback section explains mentions, the badge and the caps. `docs/Community-Creations.md`, "Mentions".
- [x] Frames, light and dark: `.scratch/frames/user-mentions-<theme>.png`.

## Landed

Not verified:
- The site's click on a user chip was not driven in a browser. The unit test covers the chip, and `FeedbackPage.tsx` maps `openProfile` to `/u/<name>`.

For you:
- Look at the user chip and the "Unknown user" chip in `.scratch/feedback-links-07/frames/user-mentions-light.png` and `-dark.png`; they follow the ticket 01 frames.
- The chip click uses the surface's existing profile provider (the app's profile dialog, the site's `/u/<name>`), not a new `openProfile` field on the link place. Only `profileHref` is new there.
