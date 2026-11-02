# 11: Pay and Delete Fixes

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Three small fixes from the close review, each with a clear ruling and a test seam that already exists.

## What to build

- **Delete confirm:** deleting any Persona or entity whose own stat backs a Currency shows a confirm that names the Currency. Today a plain Persona skips it, and the Currency becomes Name Only with no warning.
- **Bare price with an item:** a pay with item Silver and price 5 means 5 Silver. Today it charges 5 Copper. A money word in `currency` keeps working as it does, and a real conflict stays refused.
- **Played entities:** a played entity's name counts as the player in a pay or buy, for every played entity. Today a second played entity's name reads as blank, so its payment is income and costs it nothing.

Rulings: Q79, Q80, Q81.

## Acceptance criteria

- [ ] Deleting a plain Persona or entity whose own stat backs a Currency shows a confirm naming it. A delete that affects no Currency shows no new confirm. Tests go through the UI path, not `removeEntity` alone.
- [ ] A pay with item Silver and price 5 moves 5 Silver. A pay with item Gold and price "5 Silver" behaves as a named conflict under Q50. A test fails when each is reverted.
- [ ] A second played entity paying is charged, and the same name as a seller or buyer works. A test fails when the name stops resolving.
- [ ] Each fix's guard is proved by reinstating its bug.
- [ ] The pay probe, cloud default, shows no case falling against its in-batch control. The numbers are in the landing.
- [ ] Docs match, and a changelog fragment exists only if a released surface changed.

For you: delete a Persona whose own stat backs a Currency. Does the confirm read clearly?
