# 01: Suspend length dialog

Status: done
Blocked by: None (can start immediately)
Server dependency: FormamorphServer `docs-internal/specs/timed-suspensions/issues/01-timed-suspension-status-route.md` must land first.
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Follows the quarantine dialog closely, but it carries copy and design-system review.

## What to build

In Admin Panel → Users, **Suspend** asks for a length, with 7 days preselected, or **Until Lifted**. The row then shows when the suspension ends. **Suspend** stays on suspended rows and sets a new end. The follow-up message template names the end date.

## Acceptance criteria

- [ ] A suspension dialog shaped like the quarantine dialog shares its day options and default, and adds **Until Lifted**.
- [ ] Confirming sends `days` (a number, or `null` for **Until Lifted**). Canceling sends nothing. The confirm button is disabled while the request runs.
- [ ] On a suspended account, the dialog states that it replaces the current end.
- [ ] The row takes `status` and `suspended_until` from the response. The Status column shows "until <date>" in the viewer's locale only when there is an end.
- [ ] **Activate** clears the date from the row.
- [ ] The message prompt body names the end date only when there is one.
- [ ] The admin user type gains `suspended_until: string | null`.
- [ ] The dialog has a dev route entry, and its copy passes the copy sweep.
- [ ] A changelog fragment adds one Minor → Added entry for staff.
- [ ] `ManageUsersTab` tests cover the spec's Testing Decisions for this surface.
