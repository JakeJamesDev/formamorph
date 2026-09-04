# 16 — E2E: publish-with-entry → contest tab

Type: task
Status: done
Status note: shipped 2026-08-20
Blocked by: 11, 13, 14
Repos: formamorph (+ a local FormamorphServer instance)

## Scope

One Playwright flow in the existing E2E suite (which stays outside the four gates), per
[spec.md](../spec.md) §Testing Decisions:

- Against a local FormamorphServer with an active contest seeded: sign in, publish a world with
  the entry switch on, open Community Creations, see the entry in the Contest tab (and the
  regular catalog).
- Skip cleanly when the local server isn't reachable (the suite must not fail on machines
  without it).
- Reuse the existing two-viewport setup only if cheap; one viewport is acceptable for this flow.

## Done

Flow passes locally against a seeded server; suite skips (not fails) without one; `npm run
test:e2e` otherwise unchanged.

## Outcome

[e2e/contest-entry.spec.ts](../../../e2e/contest-entry.spec.ts) — desktop project only; mobile skips.
Verified against a scratch FormamorphServer (own `DATA_DIR`/`DB_PATH`/`STORAGE_ROOT`, seeded admin,
one active contest): the flow passes in 8.6s. Publishing *without* the switch was tried as a mutation
and the contest-tab assertion went red, so the guard bites. Unset `E2E_API_URL`, an unreachable one,
and a server with no contest each skip rather than fail.

Two things the ticket didn't name and the build added: `E2E_API_URL` is also handed to the dev server
as `VITE_API_URL_DEV` (and suppresses `reuseExistingServer`), because `.env`'s dev default is the live
workshop and a run without the override would publish a test world to production; the spec additionally
aborts every off-machine request as a second belt. Seeding recipe is in [e2e/README.md](../../../e2e/README.md).
