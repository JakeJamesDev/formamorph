# 04: Client: An unchanged legacy save stays a legacy listing

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one payload rule in the schedule edit helper, plus its tests.

## Parent

[spec.md](../spec.md) — Supporter Tier Schedule.

## What to build

A legacy timed listing has no stage rows, and every tier has been open since publish. The schedule dialog prefills its lower tiers as open now. Saving those tiers unchanged now writes stage rows, so the listing's mark switches from the single public date to the full schedule. The spec says "A listing with no tier rows still reads as today." When the admin leaves every lower tier of a legacy listing untouched, the save keeps the listing without rows and changes only the public date. Found in the close review.

## Acceptance criteria

- [x] Saving a legacy listing with its lower tiers untouched leaves it with no stage rows. Its mark reads as before. (Dialog test "saves only the public date when no lower tier was touched"; service test shows the body is `supporterUntil` with no schedule key. The server writes no rows for that form, read in `worldController.js`, not run live.)
- [x] Changing the public date of a legacy listing with its tiers untouched changes only the public date. (Dialog test "changes only the public date when only that field moved".)
- [x] Changing any lower tier of a legacy listing writes the full schedule, as today. (Dialog test "writes the full schedule once a lower tier changes".)
- [x] Each guard fails with the bug put back. (Forcing the full-schedule path failed the two untouched tests in each file; dropping the untouched check failed the lower-tier tests.)

## Landed

**Not verified**
- A live save against the server: the no-rows result rests on reading `worldController.js` and `readEndDate`, not on a request.

**For you**
- Open a legacy timed listing in the schedule dialog as admin, save without changes, and check the card mark still shows the single public date.
