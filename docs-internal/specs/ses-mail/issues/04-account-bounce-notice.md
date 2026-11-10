# 04: Account Bounce Notice

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/ses-mail/spec.md` (Client; Q8, Q16, Q17)

Model rationale: two mirrored components and new user-facing copy that must follow the writing guide.

## What to build

A user whose address bounced, or who reported a mail as spam, sees that in the email section of the game's account settings and of the website account page. The notice says mail to this address did not get through, that a different address fixes it, and that the feedback form reaches staff when the address is correct. While the notice shows, the Resend Verification Email button is not offered. Saving a different address removes the notice.

Write the copy from this facts list, in the user's words, after reading the writing guide:

- Mail to this address bounced, or the mailbox reported our mail as spam.
- We stopped sending to it.
- Password reset will not work until an address is verified.
- A different address fixes it.
- If the address is correct, the feedback form reaches staff, who can clear it.

## Acceptance criteria

- [ ] The account summary type carries the marker reason, read from sign-in, the account read and the set-email response.
- [ ] With reason `bounce`, both email sections show the bounce notice and the feedback-form link. With reason `complaint`, both show the complaint wording.
- [ ] While the marker is set, the status line shows the address as not verified and the resend button is absent.
- [ ] The server's marked-address code from resend-verification and set-email shows the same notice, not the generic "couldn't be sent" note.
- [ ] Saving a different address removes the notice and shows the usual "verification email sent" note.
- [ ] An unmarked account renders exactly as before.
- [ ] The website account page's bundle still holds no game code.
- [ ] The dev router can show both email sections in the marked state, for each reason.
- [ ] Frames at desktop and mobile width, light and dark, for both surfaces: `.scratch/frames/account-bounce-game-<theme>-<width>.png` and `.scratch/frames/account-bounce-site-<theme>-<width>.png`.
- [ ] A changelog fragment states the new notice.

For you: read the notice wording on both surfaces and say whether it sounds like us.
