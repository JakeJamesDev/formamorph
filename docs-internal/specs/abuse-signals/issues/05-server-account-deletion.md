# 05 — Server: self-service account deletion with a Grace Period

Status: done
Type: task
Blocked by: 02
Spec: ../spec.md (Implementation Decisions › Account deletion; User Stories 32–44)

Repo: FormamorphServer.

## Task

- **Schema step**: two columns on users — deletion-requested timestamp and a boolean for whether content goes. A reserved system user seeded with the fixed placeholder username `[deleted user]`, a status that can never authenticate, and a stable id the erasure module references.
- **Request endpoint**: authenticated; body carries the password and the content choice. Wrong password → 401. Suspended → 403 with a message directing to Feedback. Success stamps both columns and writes audit `account_deletion_requested`. Nothing else changes; content stays visible.
- **Login during the window**: a successful login with a pending request clears both columns, writes audit `account_deletion_cancelled`, and adds a flag to the login response the client renders as "your deletion was cancelled."
- **Erasure module**: one function used by both the sweeper and the existing CLI tool, which becomes a thin caller. Rows change in a single transaction; storage file paths are collected inside it and the files removed after commit — this fixes the tool's current async-inside-transaction hazard.
  - Content goes: listings and their files, comments everywhere, avatar, then the user row. Cascades handle the rest.
  - Content stays: listings and comments reassigned to the placeholder user; avatar removed; contest placements' stored author name replaced by the placeholder; then the user row goes.
  - Writes audit `account_deleted` with the original username and which path ran.
- **Sweeper**: `sweepDeletions(now)` erases every account whose request is older than seven days; boot catch-up then hourly, on the existing shape.
- Three new actions in the audit ACTIONS list.

## Acceptance

- The full matrix: request → cancel by login → request again → seven days → gone. Both content paths.
- With content kept, the original username appears in no listing, comment, placement, or profile; the placeholder does; the listing files still exist.
- With content deleted, the listing files are gone from storage and the listing rows with them.
- A suspended account cannot request; a wrong password cannot; a second request while one is pending is idempotent.
- The CLI tool still works and produces the same result as the sweeper.
- Signals, likes, follows, acceptances of the erased user are gone (cascade).

## Tests

- Supertest plus the sweeper driven with `now`. Prior art: `tests/quarantine.test.js`, `tests/tokenInvalidation.test.js` (login changing state), `tests/audit.test.js`, `tests/eventPlacements.test.js`.
- Prove the transaction fix by making a file removal throw and asserting the rows are still consistent.

## Answer

Shipped in FormamorphServer `1ec8cd1` ("Let An Account Delete Itself After A Grace Period"): the request, the cancel-on-login, the seven-day sweeper, the placeholder author, and the CLI tool as a thin caller of the shared module.
