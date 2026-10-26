# 02: Review Queue For New Listings

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: FormamorphServer
Spec: the server spec (Review routes, Rejection and quarantine, Contests)

Model rationale: new routes on an existing gate and the existing quarantine call; the contest sort is the one subtle part.

## What to build

Mods list pending new listings, download their content, approve them into the catalog, or reject them into quarantine. Contest entries sort first.

## Acceptance criteria

- [x] `GET /api/reviews` lists pending new listings: contest entries first, then oldest `moderation_queued_at`. Each item has id, kind, name, author, type `new` and its contest. (reviewQueue.test: "lists a waiting new listing…", "puts contest entries first, then the longest-waiting".)
- [x] `GET /api/reviews/count` answers the waiting count. ("is staff-only, and counts the same items it lists".)
- [x] `GET /api/reviews/:id/content` serves the pending content to staff and the author. (Staff and author 200, no download counted; player 404; 404 once nothing waits.)
- [x] Approve sets `approved`, `listed_at` and `updated_at` to now, and writes `listing_approved` with `target_id`. The listing then shows in the catalog and the follows feed. (Read back as player, author and follower; feed reads `published` per ruling T19.)
- [x] Reject sets `rejected`, quarantines with the given `days` under the quarantine route's limits, writes `listing_rejected`, and answers the author plus `quarantined_at` and `quarantine_expires_at`. (camelCase `quarantinedAt` / `quarantineExpiresAt` / `quarantineExtended` per ruling T15; default 7, bounds 1–90 shared with the quarantine route through `config/quarantine.js`.)
- [x] A second approve or reject answers `409`. (Also approve after reject, and a stale reject with bad `days`.)
- [x] Every route uses `canModerate` with the staff ladder; a mod on an admin's listing is refused. (Mod on admin and on mod → 403; admin on mod → 200; player 403/404.)
- [x] A pending contest entry holds the author's one contest slot, and approving it after the contest deadline works. (`CONTEST_ALREADY_ENTERED`; approve after `endsAt` → 200, still entered.)
- [x] `readPodium` refuses an entry that is not `approved`. (Built in ticket 01; listingReview.test "cannot place on the podium until it is approved".)
- [x] From ticket 01's review: `PUT /:id/addons/:componentId/review` refuses a component its caller cannot see (pending or quarantined) the way other visibility checks do. (Same rule as the add-on list; 404 pending, 404 quarantined, 200 after release.)
- [x] From ticket 01's review: the in-circulation SQL clause, now repeated in `World.getAll`, the author totals and `Follow`, has one shared helper. (`inCirculationClause` in `config/listingReview.js`; the existing visibility suites stay green.)

## Landed

Server code: FormamorphServer `9783491` "Add Review Queue for New Listings". Full server suite 2208/2208 in 25.6 s. Nine guards were reverted one at a time and each failed a test.

**Not verified:**
- Nothing in the list above.

**For you:**
- Nothing a player can judge yet: the setting ships off, and the client shows nothing until ticket 08.
- Seen, not built: a staff member promoted after submitting can approve their own pending listing, because `canModerate` passes your own things. Rare; the client can hide it.
