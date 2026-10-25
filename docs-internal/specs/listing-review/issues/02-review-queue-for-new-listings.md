# 02: Review Queue For New Listings

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: the server spec (Review routes, Rejection and quarantine, Contests)

Model rationale: new routes on an existing gate and the existing quarantine call; the contest sort is the one subtle part.

## What to build

Mods list pending new listings, download their content, approve them into the catalog, or reject them into quarantine. Contest entries sort first.

## Acceptance criteria

- [ ] `GET /api/reviews` lists pending new listings: contest entries first, then oldest `moderation_queued_at`. Each item has id, kind, name, author, type `new` and its contest.
- [ ] `GET /api/reviews/count` answers the waiting count.
- [ ] `GET /api/reviews/:id/content` serves the pending content to staff and the author.
- [ ] Approve sets `approved`, `listed_at` and `updated_at` to now, and writes `listing_approved` with `target_id`. The listing then shows in the catalog and the follows feed.
- [ ] Reject sets `rejected`, quarantines with the given `days` under the quarantine route's limits, writes `listing_rejected`, and answers the author plus `quarantined_at` and `quarantine_expires_at`.
- [ ] A second approve or reject answers `409`.
- [ ] Every route uses `canModerate` with the staff ladder; a mod on an admin's listing is refused.
- [ ] A pending contest entry holds the author's one contest slot, and approving it after the contest deadline works.
- [ ] `readPodium` refuses an entry that is not `approved`.
- [ ] From ticket 01's review: `PUT /:id/addons/:componentId/review` refuses a component its caller cannot see (pending or quarantined) the way other visibility checks do.
- [ ] From ticket 01's review: the in-circulation SQL clause, now repeated in `World.getAll`, the author totals and `Follow`, has one shared helper.
