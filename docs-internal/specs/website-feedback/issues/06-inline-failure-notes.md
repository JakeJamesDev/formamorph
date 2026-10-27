# 06: Inline Failure Notes

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: three narrow fixes on seams that already exist (`inlineNotes`, the dialog's `sendError` line), plus two unmount guards.

**What to build:** on the website, every failure shows once, under the control that failed, as the ticket 04 ruling says. Found by the close review.

- [ ] On the site, pressing Send with an empty title or an empty description shows the message inside the filing form, next to the empty field. Today it goes to the page note behind the dialog, so nothing visible happens.
- [ ] On the site, a failed vote from a board list row shows its message under that row's Vote control, not at the top of the page.
- [ ] On the site, a failed send shows once, in the form. No page note stays after the dialog closes.
- [ ] The app's toasts are unchanged for all three cases.
- [ ] The filing dialog's `sendError` write and the edit dialog's `setFailure` write check `useMountedRef` after their awaits, as do the `finally` writes beside them.
