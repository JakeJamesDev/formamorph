# 02 — Server: record and purge Signals

Status: done
Type: task
Blocked by: 01
Spec: ../spec.md (Implementation Decisions › The Signal; Testing Decisions › Server)

Repo: FormamorphServer. Backend only; nothing a client sees changes.

## Task

- **Schema step**: a new table for Signals — id, user (foreign key, cascade on delete), event, address hash, browser family, created timestamp — plus indexes on hash, user, and timestamp. Added in the existing boot-migration step pattern; the boot-schema drift test must pass.
- **Salt**: read a new secret from the environment beside the token secret. At boot, before the schema step, refuse to start with a one-line message if it is unset. Tests inject it in the vitest config the way the token secret is injected. Add it to the production env staging file the deploy wizard writes, and to the server's README env list.
- **Client address**: extract the existing rate-limit resolver (Cloudflare connecting-address header, else request address) into a shared helper. The rate limiter keeps using it.
- **Browser family**: a pure function from user-agent string to `Browser/OS` over a small fixed table; unknown → `Other/Other`. No dependency.
- **Record**: a single `recordSignal(req, userId, event)` that hashes, derives the family, inserts, and never throws — errors logged and swallowed, on the audit log's `tryRecord` model. Call it after success in: register, login, like set, world create, world update (as `publish`), comment create, follow create.
- **Sweeper**: `sweepSignals(now)` deletes rows older than 90 days; started at boot with one immediate run then hourly, timer unreferenced, on the quarantine sweeper's shape.

## Acceptance

- Boot without the salt exits with the message; with it, boots.
- Each of the six actions leaves exactly one Signal for the acting user, visible through the staff endpoint ticket 08 will add — for this ticket, assert through a test-only read of the table, and replace that read with the endpoint when 08 lands.
- A Signal write failure does not fail the action.
- After the sweeper runs at a `now` 91 days on, the old row is gone and a 89-day row remains.
- Deleting a user (via the existing CLI tool) removes their Signals.

## Tests

- Supertest through the app over the in-memory DB. Prior art: `tests/likes.test.js`, `tests/quarantine.test.js` (sweeper with `now`), `tests/bootSchema.test.js`.
- Each guard proven by reinstating the defect: remove a `recordSignal` call and watch the test go red; make the sweeper keep everything and watch the retention test go red.
- Unit-test the browser-family function on a dozen real user-agent strings.

## Answer

Shipped in FormamorphServer `99bfdd2` ("Record And Purge The Abuse Signals"): the Signals table, the hashed address on login and signup and every acted-on event, and the hourly purge sweeper (timer shared in `a204874`). Changelog entry: the ⚙️ Backend ninety-day record line.
