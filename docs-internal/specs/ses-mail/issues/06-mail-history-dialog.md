# 06: Mail History Dialog

Status: ready-for-human
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: `docs-internal/specs/ses-mail/spec.md` (Client; Q12, Q13)

Model rationale: one menu item and one dialog that follow the existing sent-message History pattern.

## What to build

In the Admin Panel's user list, each row's menu gains Mail History, for all staff. It opens a dialog for that account. The dialog lists each mail's kind, when it was sent and what happened to it, newest first. When the address is marked, the dialog says so, with the reason and the date, and offers Clear Bounce. A clear reports success or failure in the dialog.

This ticket owns the client's mail-history service. The mail report in ticket 08 uses a separate one.

The server routes landed in ticket 05:

- `GET /api/users/:id/mail-history` answers `{ emailMarker, emailMarkedAt, mails: [{ kind, status, sentAt, statusAt, bounceType? }] }`, newest first. Any staff member may read any account.
- `DELETE /api/users/:id/email-marker` answers `{ cleared }`. An SES failure answers 502 `MAIL_PROVIDER_FAILED` and the marker stays. A moderator gets 403 on an admin's or another staff account's marker.

Ticket 08 exported the Usage tab's tile and table pieces. Reuse them where they fit.

## Acceptance criteria

- [x] Mail History shows in the row menu for moderators and admins. (ManageUsersTab tests: admin row, and moderator on an admin row)
- [x] The dialog lists the rows the server returned, with a readable label for each kind and status, and an empty state for an account with no mail. (MailHistoryDialog tests; frames)
- [x] A marked account shows the reason and date and the Clear Bounce action. An unmarked account shows neither. (tests; frames)
- [x] After a successful clear, the marker section disappears and a note says the user must verify again. (test)
- [x] A failed clear keeps the marker section and shows the failure. (test)
- [x] A bounced row shows whether the bounce was hard or soft. (test; marked frame)
- [x] A moderator who views an admin's or another staff account's history sees no Clear Bounce action, or sees the refusal as a clear message. (`mayClear` false from `canModerate`; dialog test and row test)
- [x] A failed history read shows an error state, not an empty list. (test)
- [x] No request is left running after the dialog closes. (test aborts the read and a running clear)
- [x] The dialog shows no email address. (the server route sends none and the dialog type has no address field)
- [x] The dialog has a dev-router entry with marked and unmarked samples. (`#dev?modal=mailHistory&tab=marked|unmarked|empty|failed`)
- [x] Frames, light and dark, at a realistic desktop width: `.scratch/frames/mail-history-<state>-<theme>.png` for marked, unmarked and empty. (1280 px wide; animations off and the help popover hidden for the capture)

For you: open Mail History on a real account after a bounce and check the labels read naturally.

## Landed

**Not verified**
- Clear Bounce against real SES: the dialog ran only against mocks and canned dev data.
- The failed-read frame: covered by a test and the `tab=failed` dev route, with no stored frame.

**For you**
- Open Mail History on a real account after a bounce and check the labels read naturally (Admin Panel, Users, the caret beside Message).
- Frames: `.scratch/ses-mail-06/frames/mail-history-marked-dark.png`, `-unmarked-`, `-empty-`, and the `-light` set.
