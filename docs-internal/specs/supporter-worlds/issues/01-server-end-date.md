# 01: Server: Timed Supporter-only end date

Status: ready-for-agent
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

- [ ] Create with `supporterOnly` and a duration sets the end date; a duration on any kind but Mascot and World is refused; a duration from a non-admin is refused.
- [ ] The Supporter-only route sets, changes and clears the end date; a past end date is refused; each change writes an audit entry.
- [ ] With an injected clock past the end date and no sweep run, the public content route serves the listing.
- [ ] Catalog and details carry the end date only while the listing is Supporter-only.
- [ ] The sweep clears the flag, moves the content file, clears the per-account cache and records the expiry; a second run changes nothing.
- [ ] A manual clear records the expiry.
- [ ] The entitlement route returns the expired listings beside the current items.
- [ ] The update reply omits `contentData` while the listing is Supporter-only and includes it after expiry.
- [ ] Each guard is shown to bite by reinstating the bug.
