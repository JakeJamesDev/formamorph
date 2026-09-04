# 08 — Moderation: linked accounts on the user row

Status: ready-for-agent
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
