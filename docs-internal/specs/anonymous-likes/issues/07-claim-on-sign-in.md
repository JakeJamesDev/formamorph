# 07: Claim on sign-in

Status: ready-for-human
Status note: Built as `737ae3fd`, review findings folded in as `c8cb7295` (a separate commit, because another session committed in between). Four gates green on the second commit: typecheck 0 errors, lint 0 errors, 11 980 tests pass in 105 s, build succeeds.
Base: abba05eb
Blocked by: 03, 06
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (User Stories › Signing in)

Model rationale: one subscriber on an existing seam with four examples beside it.

## What to build

After a guest signs in, signs up, or adopts a session, the likes given on this Install appear as the account's Likes. Hearts stay filled through the change.

## Acceptance criteria

- [x] The session-change seam calls Claim with the Install header after sign-in, sign-up, and an adopted session.
- [x] Server contract (commit `7b0b65f`): an authenticated POST with no body, the Install in the same header the guest route reads, answering `{ claimed }` = the marks that became Likes. A Claim that moves nothing is the ordinary case. 400 `install_header_invalid` for a bad header. Read the path and header name from the server repo.
- [x] The Claim is not gated by the server setting, so call it even when `anonymousLikes` is false.
- [x] Codes for an Install whose account is known: `anonymous_likes_account_suspended` and `anonymous_likes_account_own_listing` are 403; `anonymous_likes_account_already_liked` is the 200. Ticket 03's Comments hold the final contract.
- [x] The catalog refreshes after a Claim, so hearts and counts are current.
- [x] A failed Claim never blocks or delays sign-in. It retries on the next session change.
- [x] No Claim call is made when the Install id does not exist yet.
- [x] After sign-out, a listing the account Likes shows a filled heart and a press does not raise the count.
- [x] The server answers that press with a 200 that carries a code and `liked: true`. The heart stays filled on a like press and on a clear press, with no error toast.
- [x] Tests over mocked fetch: Claim on each session event; failure does not block; no call without an Install.
- [x] Four gates green.

### Built — 2026-09-20

Two commits in this repo: `737ae3fd` "Claim A Guest's Likes On Sign-In", then `c8cb7295` for the review findings.

| Piece | File |
|---|---|
| Install reader that makes no id | `src/lib/anonymousLikes.ts` |
| Claim request, session and Install together | `src/services/WorldStorageService.ts` |
| Session-change seam and the `ClaimWatch` a reader takes | `src/lib/anonymousLikeClaim.ts` |
| Watcher started once, gated on `COMMUNITY_ENABLED` | `src/App.tsx` |
| Catalog waits for a Claim, and re-reads for one that landed late | `src/lib/useCatalogSync.ts` |
| Already-liked heart through the real browser JSX | `src/views/CommunityCreationsBrowser.guestLikes.test.tsx` |
| Changelog, 👤 bucket, under a new **Likes:** group | `docs/Changelog.md` |

**Contract.** Verified against the server source rather than the ticket prose: `POST /api/users/me/anonymous-likes/claim`, `protect` only, no body, `X-Formamorph-Install`, answering `{ success, data: { claimed } }`, `400 install_header_invalid`.

**Guards.** Eleven, each reinstated in turn with its test watched go red. One did not bite on the first try and was a real test defect: the forced-refresh assertion ran against an empty cache, so no tag would have been sent either way. Fixed, then it bit.

### Two things worth carrying forward

**Waiting on the Claim is not enough on its own.** The spec review caught it. A refresh that waits covers the ordinary sign-in, where the reader changes and the refresh follows. It does nothing for the retry this ticket also asks for, because a retry runs on a session change that leaves the reader alone — an avatar write, which is the path the retry test itself uses. Nothing else would ask for the catalog again, so the hearts the retry moved stayed wrong until the browser was reopened. Waiting and being told now travel together as one interface, and the `claimed` count the route answers is what decides whether anybody is told.

**A dependency passed into a hook makes everything that closes over it reactive.** Reading `claim.settled()` inside the catalog loader is what made `react-hooks/exhaustive-deps` start naming `loadCatalog`, on a line that had been quiet for as long as the file existed. The watch is held in a ref now. Worth knowing before the next parameter is added to that hook.

### Left for somebody else

- **No preview verification.** The Claim is a background request on session change with no surface of its own, and proving it end to end needs a live server with the feature switched on. The observable half, the heart that survives the change, is covered by the browser tests. Ticket 10's Playwright spec is where the live path belongs.
- The spec's rollout order still stands: the server deploys before any client build carrying ticket 06 reaches a guest.
