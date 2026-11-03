# 03: Chips in Listing Comments

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q1, Q2, Q3, Q6, Q7, Q8, Q9; App and site)

Crosses the app and site surfaces and the link place context, so it needs care around providers and the bundle boundary.

## What to build

Every listing comment draws `@user`, `#thread` and pasted listing URLs as chips, in the app and on the website, for old and new comments. A comment draws its chips at once after a post or an edit.

In the app, a listing chip opens through the modal's listing opener, and a user chip opens the profile dialog. On the website, chips follow their addresses, a bug thread shows Unavailable thread, and a user chip opens the profile through a new provider on the community page.

A comment with no `targets` field renders as plain markdown, so an older server never turns its links into unavailable chips.

In this ticket, an app thread chip follows its address, as the default link place does. Ticket 04 makes it open the Feedback dialog.

## Acceptance criteria

- [ ] The listing modal draws all three chip kinds, the Unknown user form and the unavailable forms in app mode. Test: the rendered modal with a mocked service.
- [ ] The same modal in site mode draws chips, with a bug thread shown as Unavailable thread. Test: the rendered modal with site capabilities.
- [ ] A comment with no `targets` shows its `@name` as plain text, with no unavailable chip. Test: the rendered modal.
- [ ] A posted and an edited comment draw chips from the write response. Test: the rendered modal with user events.
- [ ] A plain click on a listing chip calls the modal's listing opener, and a modified click leaves the browser's link. Test: the rendered modal with user events.
- [ ] A user chip click opens the profile in the app and on the website. Test: the rendered modal in both modes.
- [ ] The site bundle boundary test stays green with the new provider.
- [ ] The wiki's mentions section in the community docs says that listing comments draw links and that a listing comment mention sends no alert.
- [ ] A changelog fragment covers chips in listing comments.
- [ ] Frames of a comment with all three chip kinds, light and dark, at a realistic width: `.scratch/frames/listing-comment-chips-<theme>.png`.

For you: Open a listing with old comments and check that the chips read well there, in the Community browser's comment list.
