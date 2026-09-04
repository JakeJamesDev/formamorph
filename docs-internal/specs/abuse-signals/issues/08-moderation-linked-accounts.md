# 08 — Moderation: linked accounts on the user row

Status: ready-for-human
Type: task
Blocked by: 02
Spec: ../spec.md (Implementation Decisions › Moderation surfaces › Linked accounts; User Stories 25, 26, 30)

Both repos. Can be built whenever; nothing else depends on it.

## Task

**Server**
- A staff endpoint for a user returning every other account that shares any of the subject's address hashes within retention: for each match, the other account's id, username, status, created timestamp, and the list of (event, timestamp) pairs on both sides that matched.
- Calling it writes audit `signals_viewed` with the viewer as actor and the subject as target. Every call, not the first.
- Add the action to the ACTIONS list; it appears in the existing audit filter.
- Replace ticket 02's test-only table read with this endpoint.

**Client**
- In Manage Users, each row shows a count of linked accounts (fetched lazily when the row's details open, not for the whole list — the audit row is the reason).
- Expanding shows the list: username, status badge, account age, and the matched events with timestamps. Each name links to that user's row.
- Staff only; the control is absent for non-staff.

## Acceptance

- Two accounts sharing a hash inside retention link both ways; one outside retention does not.
- Each open writes exactly one audit row, visible in the Audit tab.
- A user with no matches shows zero and no expander.

## Tests

- Supertest for the endpoint and its audit row. Prior art: `tests/adminUsers.test.js`, `tests/audit.test.js`.
- Component test on `ManageUsersTab.test.tsx`'s pattern: the expander renders the mocked list and hits the endpoint only on open.

## Answer

Shipped in FormamorphServer `4fade98` ("Add The Linked Accounts Endpoint") and formamorph `20a7fe5e`
("Show Linked Accounts On The User Row"). Changelog entry: the ⚙️ Backend line under In Progress.

Two deliberate departures from the ticket text, both flagged for review:

- **The moments carry a browser family** beyond the "(event, timestamp) pairs" the ticket lists. Without
  it the stored column has no reader anywhere and user story 18 has no surface, and the ticket's own
  instruction to replace ticket 02's table read cannot be met for the test that asserts the family.
- **The table read survives in two places**, against "Replace ticket 02's test-only table read with this
  endpoint": proving the sweeper actually deleted a row (the endpoint filters at the retention edge
  itself, so it cannot tell a deleted row from a filtered one), and proving the address was never
  readable off the row. Both are storage properties no endpoint can stand in for. Everything a staff
  member observes now reads through the endpoint.

Also added, unasked but on `World.likesGiven`'s shape: each side of a link is capped at twenty moments
with the true total beside it, and the panel says how many it is holding back.

Left alone: the client's `AUDIT_ACTIONS` is missing five server actions added by tickets 03 and 05
(`privacy_reset_user`, `privacy_reset_all`, `account_deletion_requested`, `account_deletion_canceled`,
`account_deleted`). Entries with those actions render as "did something the app does not recognize".
That is drift from those tickets, not this one.
