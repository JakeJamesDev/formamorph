# 07: Podium Edit Refuses to Drop a Deleted Listing

Status: ready-for-human
Status note: Built in the FormamorphServer repo, commit `bb3b8e4` (unpushed). All 1,670 server tests pass, 66 s wall time. The server repo has no lint or typecheck gate; its test suite is the gate. No changelog entry: the client's Podium dialog already refuses this re-save, so no player or staff surface changes. Not deployed. One call the ticket left open: the guard runs before `readPodium`, not only before the replace, so a malformed body against such a podium now reads 409 rather than 400. The podium's own state refuses, the way an unannounced contest already does. Say so if you want the body judged first.
Base: 000ba0ef
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**Work tree:** the FormamorphServer repo.

**What to build:** A podium edit can no longer erase the archive record of a placed world whose listing was deleted. A placement row keeps its place, position, and name snapshots after the listing is deleted, and its world reference goes null. An edit replaces every row from the request, and no request can name a deleted world, so today any edit erases that row. The Podium dialog already refuses this re-save on the client. The server gets the matching guard.

The edit route refuses with 409 when the stored podium holds a row with a null world reference. The refusal names the lost world from its snapshot, so an API caller knows which record blocks the edit. The check runs before the replace and writes nothing. The announce route needs no guard, because nothing is stored before an announcement.

- [x] An edit to a podium that holds a deleted-listing row is refused with 409, and the stored rows do not change
- [x] The refusal names the lost world
- [x] No audit row and no broadcast result from a refused edit
- [x] An edit to a podium with no deleted-listing rows works as before, including an edit that adds a tie
- [x] The guard is proven to fail when it is removed: the old behavior erases the row
- [x] The server's own gates are green, and the test run time is stated
