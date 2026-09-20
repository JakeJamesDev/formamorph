# 07: Podium Edit Refuses to Drop a Deleted Listing

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Contest Ties](../spec.md)

**Work tree:** the FormamorphServer repo.

**What to build:** A podium edit can no longer erase the archive record of a placed world whose listing was deleted. A placement row keeps its place, position, and name snapshots after the listing is deleted, and its world reference goes null. An edit replaces every row from the request, and no request can name a deleted world, so today any edit erases that row. The Podium dialog already refuses this re-save on the client. The server gets the matching guard.

The edit route refuses with 409 when the stored podium holds a row with a null world reference. The refusal names the lost world from its snapshot, so an API caller knows which record blocks the edit. The check runs before the replace and writes nothing. The announce route needs no guard, because nothing is stored before an announcement.

- [ ] An edit to a podium that holds a deleted-listing row is refused with 409, and the stored rows do not change
- [ ] The refusal names the lost world
- [ ] No audit row and no broadcast result from a refused edit
- [ ] An edit to a podium with no deleted-listing rows works as before, including an edit that adds a tie
- [ ] The guard is proven to fail when it is removed: the old behavior erases the row
- [ ] The server's own gates are green, and the test run time is stated
