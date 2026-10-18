# Spec: Timed suspensions (client)

Status: done
Status note: Closed 2026-10-17. Tickets 01–02 done; last landing cd6621ffb, review fix 35d5603ee. Gates green on 2026-10-17.
Spec session: timed-suspensions — spec

Server side: the FormamorphServer repo, `docs-internal/specs/timed-suspensions/spec.md`. It lands first.

## Problem Statement

The **Suspend** button in Admin Panel → Users is a toggle. A suspended account stays suspended until a staff member remembers to activate it. Most suspensions are short warnings, so staff track end dates by hand, and a forgotten one locks the account indefinitely. Quarantine already asks for a length and ends on its own.

## Solution

**Suspend** opens a dialog shaped like the quarantine dialog. The staff member picks a length from 1 to 90 days, with 7 days preselected, or **Until Lifted**. The server ends a timed suspension by itself. The Users table shows when each suspension ends. **Suspend** stays available on a suspended account so staff can set a new end. The suspension message template names the end date. The audit log shows a suspension that ended on its own.

## User Stories

1. As a staff member, I want Suspend to ask for a length, so that I set the end when I act.
2. As a staff member, I want 7 days preselected, so that the common warning takes one confirm.
3. As a staff member, I want the same day choices that quarantine offers, so that both tools feel the same.
4. As a staff member, I want an Until Lifted choice, so that I can suspend a serious case with no end.
5. As a mod, I want Until Lifted available to me as well as to admins, so that I can act on a serious case at once.
6. As a staff member, I want to cancel the dialog without suspending, so that a misclick does nothing.
7. As a staff member, I want the confirm button disabled while the request runs, so that I cannot suspend twice.
8. As a staff member, I want Suspend available on an account that is already suspended, so that I can lengthen, shorten, or remove the end.
9. As a staff member, I want the dialog for a suspended account to say that it replaces the current end, so that I know what the action does.
10. As a staff member, I want the Users table to show "until <date>" next to Suspended, so that I see each end at a glance.
11. As a staff member, I want no date shown for a suspension with no end, so that the table does not suggest an end that does not exist.
12. As a staff member, I want the date in my own locale, so that I read it without converting time zones.
13. As a staff member, I want the row to update from the server's response, so that the date I see is the one the server stored.
14. As a staff member, I want Activate to clear the date from the row, so that the table matches the account.
15. As a staff member, I want the follow-up message prompt to prefill the end date in the template, so that the user learns how long it lasts without me typing it.
16. As a staff member, I want the template to omit a date for Until Lifted, so that the message stays correct.
17. As a staff member, I want an expired suspension to show in the audit log with its own label and pill, so that I can tell it apart from a staff lift.
18. As a staff member, I want to filter the audit log by that action, so that I can list every suspension that ended on its own.
19. As a staff member, I want each Suspended entry's detail to show the chosen end, so that I can see the length in the history.
20. As a suspended user, I want a refused action to tell me when my suspension ends, so that I know how long to wait.
21. As a suspended user, I want the Account Suspended banner in my profile to name the end date, so that I see it where the app already explains my state.
22. As a staff member, I want an out-of-range error from the server shown as is, so that I see what went wrong.

## Implementation Decisions

- **Dialog.** A suspension dialog modeled on the quarantine dialog, reusing its day-option list and default from the shared quarantine module, or a shared duration module both import. A **Length** select holds the day options and an **Until Lifted** option. Copy follows the Writing Guide and goes through the copy sweep. The **Length** select offers the shared presets (3, 7, 14, and 30 days) plus **Until Lifted**; the 1–90 range is the server bound, not the picker list.
- **Request.** Confirming sends `{ status: 'suspended', days }`, with `days: null` for Until Lifted. Activate sends `{ status: 'normal' }` unchanged.
- **Row state.** The row takes `status` and `suspendedUntil` from the response's user, not from the request, so the table shows the stored end.
- **Table (Q7).** The Status column renders the existing status pill and, for a suspended account with an end, a short "until <date>" line in the viewer's locale.
- **Re-suspend (Q4).** The Suspend action shows for every account the viewer may moderate, suspended ones included. On a suspended account the dialog states that the new length replaces the current end.
- **Message template (Q3).** The post-suspend message prompt fills the end date into the subject-free body when there is one. With no end, the template is unchanged.
- **Audit presentation (Q6).** `suspension_expired` gets a label, a pill style, a filter option, and a detail line that names no actor. `user_suspended` details show the server's end snippet.
- **Suspended user (Q3).** The Account Suspended banner in the profile header reads the signed-in account's `suspendedUntil` and names the end date when there is one. The email and password notes stay unchanged, so the date shows once per screen (ruling to ticket 02, 2026-10-17). Refusal toasts already show the server's `error` text, which now carries the date; no client change there beyond verifying it.
- **Types.** The admin user record and the signed-in account record gain `suspendedUntil: string | null`. This is an API read shape, not a world or save export shape.
- **Dev route.** The new dialog gets a `devRoutes.ts` entry.
- **Changelog.** One Minor → Added entry for staff, written as a fragment.

## Testing Decisions

- Tests drive the rendered UI with mocked fetch and assert on what the user sees and what the request carries. No test reaches into component state.
- **ManageUsersTab.** Suspend opens the dialog with 7 days preselected; confirming sends `days: 7`; Until Lifted sends `days: null`; cancel sends nothing; the row shows the response's end date; a no-end suspension shows no date; Suspend is present on a suspended row; Activate clears the date; the message prompt body names the date only when there is one.
- **Audit log.** `suspension_expired` renders its label and filter option; a `user_suspended` detail shows the end snippet.
- **Profile banner.** The Account Suspended banner names the end date when present and keeps today's text when absent.
- Prior art: `ManageUsersTab.test.tsx`, `AuditLogTab.test.tsx`, `RemoteWorldCard.quarantine.test.tsx` for the quarantine dialog flow.

## Out of Scope

- Hour-level durations (Q2).
- A notice when a suspension ends (Q5).
- Showing a suspension end on public profiles.
- A countdown or relative time ("in 3 days").

## Further Notes

- Rulings Q1–Q10 live in the server spec's Further Notes. The client carries Q1–Q4, Q6, Q7, and Q9; the rest are server behavior.
- The server's omitted-`days` rule keeps today's builds on no-end suspensions; this client always sends `days`.
