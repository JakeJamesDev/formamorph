# 06: Inline Failure Notes

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: three narrow fixes on seams that already exist (`inlineNotes`, the dialog's `sendError` line), plus two unmount guards.

**What to build:** on the website, every failure shows once, under the control that failed, as the ticket 04 ruling says. Found by the close review.

- [x] On the site, pressing Send with an empty title or an empty description shows the message inside the filing form, next to the empty field. Today it goes to the page note behind the dialog, so nothing visible happens. Verified: `feedbackInlineFailures.test.tsx`: empty title and empty description.
- [x] On the site, a failed vote from a board list row shows its message under that row's Vote control, not at the top of the page. Verified: `feedbackInlineFailures.test.tsx`: failed vote under its row only; breaking the guard failed that test.
- [x] On the site, a failed send shows once, in the form. No page note stays after the dialog closes. Verified: `feedbackInlineFailures.test.tsx`: send failure sets the form line and calls no notify; a 401 still notifies.
- [x] The app's toasts are unchanged for all three cases. Verified: `feedbackInlineFailures.test.tsx`: app keeps notify for empty title, failed send and failed vote.
- [x] The filing dialog's `sendError` write and the edit dialog's `setFailure` write check `useMountedRef` after their awaits, as do the `finally` writes beside them. Verified: `useMountedRef` guards the `setSendError`/`setIsSending` and `setFailure`/`setSaving` writes (code read; no unmount test).

## Landed

**Not verified**

- Unmount guards: no test unmounts mid-await; checked by reading the code.

**For you**

- Website: press Send with an empty title, then fail a send and a list vote (offline), and read each message at its control.
