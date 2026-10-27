# 07: User Mentions

Status: ready-for-agent
Blocked by: 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q1, Q8, Q9, Q18, Q23)

## What to build

`@username` in a feedback body or comment links to the player's profile in the app and on the website. A name with no account shows as "unknown user", with the typed name hidden. A post refused for the mention cap shows the server's message in the post's error place.

## Acceptance criteria

- [ ] The thread view in app mode and site mode renders a user link for a resolved target and "unknown user" for an unavailable one, with the typed name absent from the DOM.
- [ ] Clicking a user link opens that profile in the app and at the profile route on the site.
- [ ] The editor shows the cap refusal and keeps the typed text.
- [ ] The wiki's feedback section explains mentions, the badge and the caps.
- [ ] Frames, light and dark: `.scratch/frames/user-mentions-<theme>.png`.
