# 09 — Server: events table, model, read routes & transitions

Type: task
Status: done
Repo: FormamorphServer

## Scope

The generic events layer, per [spec.md](../spec.md) §Implementation Decisions → "Server — events
layer" (all details there are binding):

- `events` table in the standard table-creation path + indexes (type, starts_at, ends_at). No
  status column; ISO writes, `datetime()` comparisons.
- Event model with derived state (scheduled/active/ended, `cancelled_at` overriding) and DTOs
  carrying linked message ids.
- `GET /api/events/active` (optionalAuth) and `GET /api/events` (started incl. ended;
  future-scheduled staff-only, viewer-dependent; cancelled excluded from public lists).
- Sweeper twin of the quarantine sweeper: boot run + hourly unref'd interval + lazy check in
  front of the events read path. Transitions: start = pinned auto-templated broadcast
  (`sender_as: 'team'`, sender = creator), store id; end = recall pinned (every type) + contest
  end broadcast (scope-`new`); cancel = recall + notice if started; never-started cancel posts
  nothing.
- Broadcast templates server-side; verify against the existing message model (recall + scope on
  update were confirmed present).

Grounding: [research/server-capability-map.md](../research/server-capability-map.md) (schema,
sweeper pattern, timestamp trap, test-context rule). Contract source:
[03-events-api-contract.md](03-events-api-contract.md).

## Done

Supertest suite at the HTTP seam (in-memory DB via the test context helper): boot-twice migration
idempotency, state derivation across time boundaries, both read routes' visibility matrix,
transition side effects observable through the messages API. Existing server test suite stays
green.

## Comments

Built 2026-08-20 in FormamorphServer (uncommitted → committed on `main` there):

- `events` table + three indexes in `createTables`/`createIndexes`; no column migration needed, so the
  boot path is unchanged apart from the sweeper.
- `src/models/Event.js` — state derived in SQL (`datetime()` on both sides), `dueToStart`/`dueToEnd`
  asking what is still *owed* rather than what has ended, which is what makes a second sweep a no-op.
- `src/utils/eventBroadcasts.js` — the three templates; `src/utils/sweepEvents.js` — the quarantine
  sweeper twin plus `startEvent`/`endEvent`/`cancelEvent` for ticket 10's routes to call.
- `GET /api/events/active` and `GET /api/events` (optionalAuth, lazy sweep, staff see scheduled +
  cancelled). New `AuditLog.ACTIONS` added ready for tickets 10/11.
- `tests/events.test.js`: 26 cases at the HTTP seam; whole suite 744 passing in 14s.

Two behaviors settled while building, worth carrying into ticket 10: a cancellation notice is filed in
`end_message_id` (it *is* the closing notice, and replaces "judging has begun" when a contest is called
off during judging), and window validation is the write routes' job — the model stores what it is given.
