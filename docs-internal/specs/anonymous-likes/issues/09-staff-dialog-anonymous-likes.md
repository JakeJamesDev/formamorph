# 09: Staff dialog for Anonymous Likes

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (User Stories › Moderating)

Model rationale: extends an existing dialog and its audit view with rows of a second kind.

## What to build

In the Likers dialog, staff see the anonymous count, see Anonymous Likes in the audit groups, remove one group or all of them, and can tell a claimed Like from a fresh one.

## Acceptance criteria

- [ ] The Likers list shows "N anonymous" beside the account total.
- [ ] The audit view shows Anonymous Like rows inside their address groups, and flags a match with the author.
- [ ] Server contract: the Likers list carries `data.anonymous`; account rows carry `claimedAt`; an Anonymous Like row is `{ likedAt, browserFamily, groupId, linkedToAuthor, addressKey }`. Ticket 04's Comments hold the final paths.
- [ ] The remove-group action sends the row's `addressKey`. A group that spans two addresses shows one action per address. A row with a null `addressKey` has no single-remove action.
- [ ] Both removals answer with the summed count and the remaining anonymous count; the dialog and the card each take their number from the response.
- [ ] Rows with a blank hash are listed as ungrouped.
- [ ] Two actions sit beside the existing removal: remove this group's Anonymous Likes, and remove all Anonymous Likes. Each confirms first.
- [ ] A removal updates the public count in the grid and the open detail view, through the existing likes-changed path.
- [ ] A claimed Like shows a marker and its original time.
- [ ] The audit still fetches only on a press.
- [ ] Changelog In-Progress entry, 🛠️ bucket.
- [ ] Tests over mocked fetch for the count, the groups, both removals, and the marker.
- [ ] Verified in the preview through the dev router with a staff session and seeded rows.
- [ ] Four gates green.
