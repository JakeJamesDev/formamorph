# 11: Client: Installed Mascot after its listing expires

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: extends ticket 07's expired-list rule to the Mascot sync.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

Found in ticket 07's landing. A good check still removes an installed Supporter Mascot once its listing expires, though the listing is now public. Under R1 and R4, the Mascot sync keeps an installed Mascot whose listing is in the expired list.

## Acceptance criteria

- [x] A good check that lists the Mascot's listing as expired keeps the installed Mascot. (`keeps an installed Mascot whose listing a good check lists as expired`)
- [x] A listing in neither list is removed as before. (`gone` in the same test; existing `removes an installed item that a good check no longer lists`)
- [x] Each guard is shown to bite by reinstating the bug. (Disabled the expired branch: keep test failed. Dropped the kind check: other-kind test failed.)

## Landed

**Not verified**
- None. The fix is in `applyGoodCheck` in `supporterContent.ts`. The Mascot sync follows the `installed` list, so it needed no change.

**For you**
- None.
