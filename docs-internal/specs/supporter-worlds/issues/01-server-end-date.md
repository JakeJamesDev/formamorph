# 01: Server: Timed Supporter-only end date

Status: done
Base: 8abd888
Repo: FormamorphServer
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Model rationale: a schema step, one read-time helper threaded through existing routes, and a sweep on the existing scheduler. Many call sites, little novelty.

## Parent

[spec.md](../spec.md) — Timed Supporter Content and Supporter Worlds.

## What to build

An admin can give a Supporter-only Mascot or World listing an end date, as a duration in days, when they create it or later through the Supporter-only route (R2, R16). Once the date passes, every route treats the listing as public: the public and dependency content routes serve it, the entitlement route stops listing it as current, and the catalog and details drop the end date (R1). This holds at read time, with no wait for a sweep. An hourly sweep then finalizes it: it clears the flag, moves the file to the public area, clears the per-account cache, and records the expiry. An admin clearing the flag by hand records the expiry too. The entitlement route lists formerly Supporter-only listings beside the current items, so the client can keep those Supporter Copies while the account qualifies (R4, R12).

## Acceptance criteria

- [x] Create with `supporterOnly` and a duration sets the end date; a duration on any kind but Mascot and World is refused; a duration from a non-admin is refused. (`an end date on create`)
- [x] The Supporter-only route sets, changes and clears the end date; a past end date is refused; each change writes an audit entry. (`the Supporter-only route and the end date`)
- [x] With an injected clock past the end date and no sweep run, the public content route serves the listing. (`read-time expiry, with no sweep run`)
- [x] Catalog and details carry the end date only while the listing is Supporter-only. (`carries the end date in the catalog and details only while Supporter-only`)
- [x] The sweep clears the flag, moves the content file, clears the per-account cache and records the expiry; a second run changes nothing. (`the expiry sweep`)
- [x] A manual clear records the expiry. (`a manual clear`)
- [x] The entitlement route returns the expired listings beside the current items. (`stops listing it as current and lists it as expired`)
- [x] The update reply omits `contentData` while the listing is Supporter-only and includes it after expiry. (`omits contentData from the update reply ...`)
- [x] Turning the Supporter-only flag on refuses while a pending update of the listing holds a linked image, and names each location (R33; found in ticket 02's landing). (`flagging a listing while a pending update links an image`)
- [x] Each guard is shown to bite by reinstating the bug. (27 mutations, each turned a named test red; one survivor, the audit entry on flag-with-date, got an assertion and then turned red)

## Landed

**Not verified**
- None unticked. The route tests use the fake `Date` as the clock, not a clock passed into the route code.

**For you**
- Hidden Gems still excludes a listing past its end date until the sweep clears it (`src/models/HiddenGem.js`, `supporter_only = 0`). The gap lasts at most one hour and I left it.
- `reviewController.forAccount` uses the read-time helper, but no test pins that guard.
- The Supporter-only route also accepts `supporterUntil` (a future ISO date) beside `supporterDays`. The ticket names days only.
- A catalog or details row omits `supporter_until` when it has no end date, so the row shape for older clients is unchanged.
