# 09: Staff dialog for Anonymous Likes

Status: in-progress
Base: 1745a81f
Blocked by: 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (User Stories › Moderating)

Model rationale: extends an existing dialog and its audit view with rows of a second kind.

## What to build

In the Likers dialog, staff see the anonymous count, see Anonymous Likes in the audit groups, remove one group or all of them, and can tell a claimed Like from a fresh one.

## Acceptance criteria

- [x] The Likers list shows "N anonymous" beside the account total.
- [x] The audit view shows Anonymous Like rows inside their address groups, and flags a match with the author.
- [x] Server contract: the Likers list carries `data.anonymous`; account rows carry `claimedAt`; an Anonymous Like row is `{ likedAt, browserFamily, groupId, linkedToAuthor, addressKey }`. Ticket 04's Comments hold the final paths.
- [x] Final shapes (server commit `6a12586`): the Likers list is `{ total, rows, anonymous }`; the audit is `{ total, rows, anonymous, anonymousRows }`; both removals answer `{ removed, likes, anonymous }`.
- [x] The audit list is capped at 500. When `anonymous` is larger than `anonymousRows`, say the list is cut short.
- [x] A removal that answers `removed: 0` is not an error: another moderator got there first. Refresh the list quietly.
- [x] `groupId` is never sent back to the server.
- [x] The remove-group action sends the row's `addressKey`. A group that spans two addresses shows one action per address. A row with a null `addressKey` has no single-remove action.
- [x] Both removals answer with the summed count and the remaining anonymous count; the dialog and the card each take their number from the response.
- [x] Rows with a blank hash are listed as ungrouped.
- [x] Two actions sit beside the existing removal: remove this group's Anonymous Likes, and remove all Anonymous Likes. Each confirms first.
- [x] A removal updates the public count in the grid and the open detail view, through the existing likes-changed path.
- [x] A claimed Like shows a marker and its original time.
- [x] The audit still fetches only on a press.
- [x] Changelog In-Progress entry, 🛠️ bucket.
- [x] Tests over mocked fetch for the count, the groups, both removals, and the marker.
- [x] Verified in the preview through the dev router with a staff session and seeded rows.
- [ ] Four gates green. (See Comments: this unit's files are green; the shared tree is red from another session's in-flight edits.)
