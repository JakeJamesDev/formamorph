# 11 — Server: contest entry storage, lock & winner

Type: task
Status: done
Blocked by: 09, 10
Repo: FormamorphServer

## Scope

Entry mechanics, per [spec.md](../spec.md) §"Server — contest entries" (binding; full rationale in
[04-entry-mechanics.md](04-entry-mechanics.md)):

- Idempotent boot migration adding nullable `contest_event_id` FK + index on `worlds`
  (quarantine-columns pattern); wire into the boot sequence.
- Publish: accept top-level `contestEventId` on world create (validator + destructure + model
  create + fixed INSERT list); refuse unless it names the currently-active contest; second
  non-withdrawn entry per user → 409 whole publish, distinct code.
- Withdraw: `DELETE /api/worlds/:id/contest` — owner-or-canModerate, `updated_at` untouched,
  always audited (`entry_withdrawn`, self → null target); 409 on the picked winner.
- Post-deadline lock: owner content update refused (contest-lock code) while entered ∧ ended ∧
  no winner ∧ not cancelled; staff bypass; spoiler/comments/likes/quarantine/delete unaffected;
  owner delete = implicit withdraw.
- Winner: `PUT /api/events/:id/winner` (any staff) — guards (exists, un-withdrawn entry of this
  event, not quarantined, picker≠author), stamps `winner_name`/`winner_author_name` snapshots,
  `winner_world_id` ON DELETE SET NULL, winner broadcast + id stored (transition from 09),
  `winner_picked` audit.
- Cancel bulk-clear of entry flags (if deferred from ticket 10, lands here).

## Done

Supertest coverage: entry accept/refuse matrix, 409 one-per-user, withdraw semantics + audit,
lock matrix (owner blocked / staff bypass / adjacent mutations live / lock lifts on winner and
cancel), winner guards, snapshot survival after world delete, cancel bulk-clear, and old-client
invisibility (publish without the field; catalog response shape unchanged). Suite green.

## Answer

Built in FormamorphServer. `contest_event_id` lands on `worlds` in `createTables` and in an idempotent
`addContestColumn.js`, wired ahead of `createIndexes()`; the FK is `ON DELETE SET NULL` so an event with
entries stays deletable.

- **Entry** rides top-level `contestEventId` on `POST /api/worlds` (validator + destructure + `World.create`
  + the fixed INSERT list). Refused with `CONTEST_NOT_ACTIVE` unless it names `Event.activeContest()` —
  which catches a wrong id, a scheduled or ended window, a cancelled contest and an announcement alike.
  A second entry is `CONTEST_ALREADY_ENTERED` and refuses the whole publish, before any file is written.
- **Withdraw** is `DELETE /api/worlds/:id/contest`, owner-or-`canModerate`, `updated_at` untouched, always
  audited (self → null target). The picked winner refuses with `CONTEST_WINNER`.
- **Lock**: `judgingContest()` = entered ∧ ended ∧ no winner (a cancel clears entries, so cancelled cannot
  reach it). Owner content update 409s with `CONTEST_LOCKED`; staff bypass; spoiler, likes, comments,
  quarantine and delete stay live; owner delete takes the flag with the row.
- **Winner**: `PUT /api/events/:id/winner`, any staff. Guards: contest, unpicked, world exists (and the id
  is a string), un-withdrawn entry of *this* event, not quarantined, picker ≠ author. Stamps
  `winner_name`/`winner_author_name`, posts the winner broadcast via `announceWinner` and stores its id,
  audits `winner_picked`.

Two calls the spec left open: a **second pick is refused** (409) rather than overwriting — the
announcement is already out and the archive names it; and there is **no un-pick route**, matching the
withdraw rule that the record stands.

56 supertest cases in `tests/contestEntries.test.js`; ten guards each proved red under mutation
(one-per-user, not-active, winner-withdraw, withdraw ownership, picker-is-author, quarantined entry,
second pick, not-an-entry, snapshot names, malformed body). Suite green: 856 tests, 28 files, 14.5s.

**Not done here:** `HANDOFF.md` still describes the kinds handoff only. Tickets 09 and 10 did not touch it
either, so the events/contest handoff write-up is still owed before the deploy to FieryLion.
