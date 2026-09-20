# 04: Staff audit and removal for Anonymous Likes

Status: in-progress
Base: 43b0faaf
Blocked by: 02, 03
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (User Stories › Moderating)

Model rationale: the address grouping is a union-find keyed by account id. Adding a second node kind without breaking the existing groups needs care.

## What to build

Staff see how many Anonymous Likes a listing has, see them grouped by shared address beside the accounts that share it, and can remove them.

## Acceptance criteria

- [ ] The Likers list response carries the anonymous count.
- [ ] The audit response carries Anonymous Like rows with a group id and a linked-to-author flag. Account rows keep their shape.
- [ ] An Anonymous Like joins a group through its hash. Rows with a blank hash are listed ungrouped.
- [ ] A single Anonymous Like that shares the author's address is reported, even though a group of one is otherwise dropped.
- [ ] Account rows carry the claimed marker from ticket 03 and the original time.
- [ ] The marker is the claim-time column ticket 03 added to the Like table: null for a like given as an account. The Like's created time is already the original press.
- [ ] The Like table is now in the boot-schema drift guard's oldest shape. Any column this ticket adds to an existing table must pass that guard, so an existing database gets it too.
- [ ] An Anonymous Like row is `{ likedAt, browserFamily, groupId, linkedToAuthor, addressKey }`. No response carries the Install id or the raw address hash.
- [ ] `addressKey` is a digest of the address hash with the listing id: stable for that listing, useless on another. It is null when the hash is blank.
- [ ] Removal routes: DELETE on the listing's anonymous-likes collection clears all; DELETE on `.../address/:addressKey` removes one address. `groupId` is display only. A group that spans two addresses takes two presses.
- [ ] Audit actions `anonymous_likes_removed` and `anonymous_likes_cleared` record the listing and the row count, never the raw hash.
- [ ] Both removals answer with the summed count and the remaining anonymous count.
- [ ] The Likers list carries `data.anonymous` beside `data.total`, and each account row carries `claimedAt`.
- [ ] The audit route still writes no audit entry.
- [ ] One staff route removes one address group's Anonymous Likes from a listing. One removes all Anonymous Likes from a listing.
- [ ] Each removal writes a new audit action, only when rows went, behind the same moderation check as the existing removal.
- [ ] Tests: mixed account and anonymous groups; the lone author match; blank-hash rows; both removals with their audit entries; a non-staff refusal.
- [ ] Fixtures use the repo's neutral names. Nothing names a real account or listing.
