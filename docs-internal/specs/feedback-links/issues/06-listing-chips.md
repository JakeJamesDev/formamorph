# 06: Listing Chips

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q3, Q16)

## What to build

A pasted community listing URL in a feedback body or comment shows as a chip with the listing's title, kind and thumbnail, and opens the listing. A hidden, pending or deleted listing shows the unavailable chip. Works in the app and on the website.

## Acceptance criteria

- [ ] The thread view in app mode and site mode renders a listing chip for a resolved target and the unavailable chip for an unavailable one.
- [ ] Clicking a chip opens the listing in the app's community view and at the listing's route on the site.
- [ ] A listing URL inside code stays plain text.
- [ ] The wiki's feedback section explains listing links.
- [ ] Frames, light and dark: `.scratch/frames/listing-chips-<theme>.png`.
