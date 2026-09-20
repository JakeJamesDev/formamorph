# 09: Staff dialog for Anonymous Likes

Status: ready-for-human
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
- [x] Four gates green.

## Comments

### Built — 2026-09-20

Landed as `deadde59` "Read And Remove Anonymous Likes In The Staff Dialog", on top of `1745a81f`.

**What shipped**

| Piece | Where |
|---|---|
| Anonymous count beside the account total | `LikersDialog` header description |
| Anonymous rows inside their address groups | `audited` memo + `anonClusterBlock` |
| One removal per address | `clusterByAddress`, keyed by `addressKey` |
| Clear-all beside the audit | `removeAnonymous({ kind: 'all' })` |
| Claimed marker and its claim time | `likerListItem`, `LikerRow.claimedAt` |
| Wire shapes | `fetchLikers`, `fetchLikersAudit`, `removeAnonymousLikeGroup`, `removeAnonymousLikes` |

**Gates.** All four green. `typecheck` 0 errors. `lint` 0 errors, 1 pre-existing warning in
`WorldOverviewManager.tsx`. `test` 732 files, 12,100 tests passed, 88.9s. `build` succeeds in 17.0s.

An earlier run was red on `src/lib/useCatalogSync.ts`, `CommunityCreationsBrowser*`,
`CommunityBrowserHost` and `site/pages/CommunityPage*`, all mid-edit by a parallel session on tickets 12
and 13. Those settled before hand-over and the numbers above are the re-run.

**Guards proved.** Eleven mutations, each red on the expected test and then reverted: the group removal
ignoring the address; `removed: 0` treated as a real removal; the anonymous count dropped from the
header; the cap notice always shown; a keyless cluster still offering a removal; clusters keyed by group
rather than address; the claimed marker never drawn; anonymous rows left out of the group sizes; the
author-match summary counting accounts only; a race always pulling the audit; and the partition dropping
its two-member rule. `LikersDialog.tsx` measures 100% statements, lines and functions, 92.5% branches.

**Verified live.** A seeded mock API on 8796 with a staff session, three account rows (one claimed),
and six anonymous rows across three addresses plus one the sweep emptied. Read through `#dev?modal=likers`:
the header read "3 likes · 14 anonymous", the audit drew a mixed group, an anonymous-only group and the
keyless row, the two-address group offered two removals, one address removal took the count 14 → 12 and
the card 17 → 15, and the clear-all left "3 likes" with no anonymous part.

**Service note.** `WorldStorageService.ts` was swept into a neighboring session's commit `a5caa429`
before this landed, so its half of the change sits in that commit rather than `deadde59`. Nothing was
lost; `a5caa429` alone does not typecheck, because the types it needs arrive here.

**Decisions worth keeping**

- Removal is keyed by `addressKey`, never by `groupId`, so rows cluster by address and a group drawn
  across two addresses gets two actions. The group number would point elsewhere by the time a press lands.
- The client re-counts group sizes over the rows still on screen, so a removal that cuts a group to one
  stops calling it a group without another server read. The server already drops its own groups of one,
  so this never hides a lone author match the server reported.
- A race answers `removed: 0`. The dialog re-reads the plain list when nobody has audited, and the audit
  only when somebody has, because the audit route must not be pulled unasked.
- The author-match count sums both kinds of row. An anonymous-only listing can hold every author match.

**Left for somebody else.** `Pending['kind']` is cascaded on in three places (`confirmation`, the service
pick, and the row drop). A fourth removal kind would want a table instead; three sites did not earn one.
