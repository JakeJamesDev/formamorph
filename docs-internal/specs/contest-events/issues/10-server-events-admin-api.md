# 10 — Server: events admin CRUD, cancel & audit

Type: task
Status: done
Blocked by: 09
Repo: FormamorphServer

## Scope

The events write surface, per [spec.md](../spec.md) §"Server — events layer":

- `POST /api/events`, `PUT /:id`, `POST /:id/cancel`, `DELETE /:id` — admin only. Cancel distinct
  from delete; hard DELETE only before start (started → cancel only); `starts_at` immutable after
  start (400); edits never re-fire broadcasts; overlap re-checked on `ends_at` changes.
- One-active-contest invariant: POST/PUT 409 on any type-contest window overlapping a
  non-cancelled contest.
- Cancel side effects beyond ticket 09's transition: bulk-clear `contest_event_id` on entries
  (column arrives in ticket 11 — coordinate; if built strictly in order, the bulk-clear lands
  guarded on column existence or moves to 11).
- New audit actions (`event_created`, `event_edited`, `event_cancelled`, `event_deleted`) via the
  never-throwing audit helper; extend the actions whitelist.

Contract source: [03-events-api-contract.md](03-events-api-contract.md).

## Done

Supertest coverage: auth matrix (public/staff/admin per route), overlap 409 (create + edit
paths), start-immutability, delete-vs-cancel rules, audit rows recorded. Suite green.

## Answer

Built 2026-08-20 in FormamorphServer. Admin `POST /api/events`, `PUT /:id`, `POST /:id/cancel`,
`DELETE /:id`, on the model seams `Event.update`, `Event.conflictingContest` and
`Event.clearEntries`.

- Overlap is asked of the **resulting** window, so extending a contest into the next one is caught
  even though its start never moved; windows compare half-open, matching the state rule.
- Type is immutable too (400) — it decides which rules apply and is already out in a broadcast.
- Create sweeps immediately, so an event scheduled for right now opens now rather than within the
  hour.
- The entry bulk-clear landed here, guarded on `worlds.contest_event_id` existing — ticket 11 adds
  the column; cancel and delete both work on a database without it.

56 supertest cases in `tests/eventsAdmin.test.js`; six guards each proved red under mutation
(admin gate, overlap, start-immutability, delete-vs-cancel, cancel audit dedupe, entry clear).
Suite green: 800 tests, 27 files.
