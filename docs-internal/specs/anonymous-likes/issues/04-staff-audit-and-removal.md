# 04: Staff audit and removal for Anonymous Likes

Status: ready-for-human
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

- [x] The Likers list response carries the anonymous count.
- [x] The audit response carries Anonymous Like rows with a group id and a linked-to-author flag. Account rows keep their shape.
- [x] An Anonymous Like joins a group through its hash. Rows with a blank hash are listed ungrouped.
- [x] A single Anonymous Like that shares the author's address is reported, even though a group of one is otherwise dropped.
- [x] Account rows carry the claimed marker from ticket 03 and the original time.
- [x] The marker is the claim-time column ticket 03 added to the Like table: null for a like given as an account. The Like's created time is already the original press.
- [x] The Like table is now in the boot-schema drift guard's oldest shape. Any column this ticket adds to an existing table must pass that guard, so an existing database gets it too.
- [x] An Anonymous Like row is `{ likedAt, browserFamily, groupId, linkedToAuthor, addressKey }`. No response carries the Install id or the raw address hash.
- [x] `addressKey` is a digest of the address hash with the listing id: stable for that listing, useless on another. It is null when the hash is blank.
- [x] Removal routes: DELETE on the listing's anonymous-likes collection clears all; DELETE on `.../address/:addressKey` removes one address. `groupId` is display only. A group that spans two addresses takes two presses.
- [x] Audit actions `anonymous_likes_removed` and `anonymous_likes_cleared` record the listing and the row count, never the raw hash.
- [x] Both removals answer with the summed count and the remaining anonymous count.
- [x] The Likers list carries `data.anonymous` beside `data.total`, and each account row carries `claimedAt`.
- [x] The audit route still writes no audit entry.
- [x] One staff route removes one address group's Anonymous Likes from a listing. One removes all Anonymous Likes from a listing.
- [x] Each removal writes a new audit action, only when rows went, behind the same moderation check as the existing removal.
- [x] Tests: mixed account and anonymous groups; the lone author match; blank-hash rows; both removals with their audit entries; a non-staff refusal.
- [x] Fixtures use the repo's neutral names. Nothing names a real account or listing.

## Comments

### Built — 2026-09-20

Landed in FormamorphServer as one commit, `6a12586` "Read And Remove Anonymous Likes In The Staff Audit", on top of `3d7ead0`. The `Base:` line above names the client repo's HEAD at claim time; the server repo's base is `3d7ead0`.

**What shipped**

| Piece | Where |
|---|---|
| Grouping takes non-account nodes | `Signal.sharedAddressGroups(userIds, againstUserId, extraNodes)` |
| Audit read | `getLikersAudit` adds `anonymous` and `anonymousRows` |
| Likers list | `getLikers` adds `anonymous`; `likerRow` adds `claimedAt` |
| Removal | `DELETE /api/worlds/:id/anonymous-likes` and `.../anonymous-likes/address/:addressKey` |
| Address key | New `src/utils/addressKey.js`; resolved by `AnonymousLike.removeByAddressKey` |
| Audit actions | `anonymous_likes_removed`, `anonymous_likes_cleared` |

**Gates.** The server repo's only gate is `npm test`; it has no typecheck, lint or build script, and no graphify graph. 51 files, 1662 tests passed, 37.45s wall clock.

**Guards proved.** Four mutations, each red on the right test and then reverted: blank hashes allowed to group; the listing id dropped from the key; the log written on attempts rather than corrections; the address dropped from the key, which is what makes the two-press test bite.

**Response shape changed** on three staff endpoints. Ticket 09 builds against them.

- `GET /:id/likes` gains `data.anonymous`, and every row gains `claimedAt`.
- `GET /:id/likes/audit` gains `data.anonymous` and `data.anonymousRows`, and every account row gains `claimedAt`.
- `DELETE` on either anonymous-likes path answers `{ removed, likes, anonymous }`.

No world or save export shape changed. No column was added, so the drift-guard criterion was already satisfied by ticket 03.

**Decisions worth keeping**

- Removal is keyed by address, never by `groupId`. The group number is assigned by scan order and would shift between the read and the press. `groupId` is display only.
- The raw address hash and the Install id stay on the server. `addressKey` is a one-way digest of the hash with the listing id, computed per request and never stored.
- Both removals sit behind `canModerate` against the listing's author, as `quarantineWorld` does. A mark has no account of its own to protect.
- `LIKE_LIST_LIMIT` now hangs off the `World` export so both halves of the screen share one ceiling.

**Left for somebody else.** `CONTEXT.md` gained **Address key** and grew its **Anonymous Like** and **Audit log** entries. The **Install**, **Anonymous Like** and **Claim** terms the parent spec asks for already landed with tickets 01-03.
