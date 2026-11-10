# 04: Account Bounce Notice

Status: ready-for-human
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

- [x] The account summary type carries the marker reason (`emailMarker`: `bounce`, `complaint` or nothing), read from sign-in, the account read and the set-email response. The server's marked-address code is `EMAIL_UNDELIVERABLE`, HTTP 409. (`AuthUser.emailMarker`; `AuthService.test.ts` "the undeliverable marker" covers login, `/auth/me`, set-email, resend and verify.)
- [x] With reason `bounce`, both email sections show the bounce notice and the feedback-form link. With reason `complaint`, both show the complaint wording. (`AccountSettingsTab.marker.test.tsx`, `AccountPage.test.tsx` "an address mail no longer reaches".)
- [x] While the marker is set, the status line shows the address as not verified and the resend button is absent. (Same tests; "Not verified." per the spec session's ruling.)
- [x] The server's marked-address code from resend-verification and set-email shows the same notice, not the generic "couldn't be sent" note. (Resend and same-address save tests on both surfaces.)
- [x] The website's verify-email page shows the bounce notice, not "Link Expired", when the server refuses a link with the marked-address code. (`VerifyEmailPage.test.tsx`; combined wording per ruling 2.)
- [x] Saving a different address removes the notice and shows the usual "verification email sent" note. ("removes the notice once a different address is saved", both surfaces.)
- [x] An unmarked account renders exactly as before. (Every earlier email test passes unchanged apart from the new outcome field.)
- [x] The website account page's bundle still holds no game code. (`site/bundleBoundary.test.ts`; ceiling 76 → 78 for the notice and its DEV fixture.)
- [x] The dev router can show both email sections in the marked state, for each reason. (Game `#dev?modal=profile&tab=settings&fixture=emailMarker-bounce` or `-complaint`; site `/account?fixture=emailMarker-bounce` or `-complaint`.)
- [x] Frames at desktop and mobile width, light and dark, for both surfaces: `.scratch/frames/account-bounce-game-<theme>-<width>.png` and `.scratch/frames/account-bounce-site-<theme>-<width>.png`. (Playwright, plus `account-complaint-site-light-desktop.png` and `verify-email-undeliverable-light-desktop.png`.)
- [x] A changelog fragment states the new notice. (`docs-internal/changelog.d/ses-mail-04.md`.)

For you: read the notice wording on both surfaces and say whether it sounds like us.

## Landed

The in-game link opens the Feedback window on its **Questions** tab (it posts to the same boards with the signed-in account). The website link is the fallback only where no host supplies that opener. The site links `/feedback?board=questions`.

**Not verified**

- Nothing left unticked. A live bounce from the server was not used; the frames run on the DEV fixture.

**For you**

- For you: read the notice wording on both surfaces and say whether it sounds like us. Heading **Email Stopped**; causes "Email to this address bounced, so no more email goes to it." and "This mailbox marked an email from Formamorph as spam, so no more email goes to it." See `.scratch/ses-mail-04/frames/account-bounce-game-light-desktop.png` and `.scratch/ses-mail-04/frames/account-complaint-site-light-desktop.png`.
- The verify-email page's title "Address Not Reachable" and its combined wording: `.scratch/ses-mail-04/frames/verify-email-undeliverable-light-desktop.png`.
- The game's text link is foreground-colored without an underline, per the design system's text-link rule. Check it reads as a link in dark: `.scratch/ses-mail-04/frames/account-bounce-game-dark-desktop.png`.
