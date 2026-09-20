# 03: Claim and linked-account guards

Status: ready-for-human
Status note: Built in FormamorphServer as 3d7ead0, review findings folded into the same commit. `Base:` below is the claim-time pointer in this repo; the server-side base is 916571a.
Base: 3a06ed47
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (User Stories › Signing in; Implementation Decisions › Server)

Model rationale: a transaction with overlap rules, a column on an existing table, and guards whose order matters. This is where a second like could leak through.

## What to build

A signed-in request with an Install header performs a **Claim**: the Install's Anonymous Likes become account Likes, and the server links the Install to the account. After that, a signed-out request from the Install is checked against the linked account.

## Acceptance criteria

- [x] A new table links an Install to the one account that last claimed it. It cascades with the account, so erasure removes it.
- [x] The Like table gains one nullable column that marks a claimed Like. The claimed Like keeps the time the Anonymous Like was given.
- [x] Claim runs in one transaction. For each Anonymous Like: insert a claimed Like unless the account already Likes the listing or wrote it; delete the Anonymous Like either way.
- [x] Claim writes one `like` Signal for the account and upserts the link.
- [x] Claim is idempotent. A mark that becomes a Like leaves its listing's total unchanged. Each skipped mark (overlap, own listing) lowers that total by exactly one. A second Claim changes no total.
- [x] Claim sits behind the normal authenticated gate, so an account that has not accepted the Privacy Policy cannot claim.
- [x] The anonymous route refuses, in the spec's order: linked account suspended; linked account wrote the listing; linked account already Likes the listing (answers liked, not an error).
- [x] The `like` Signal is written only when the Claim inserted at least one claimed Like. The link upsert runs on every call.
- [x] The "already Likes" answer is a 200 with its code, `liked: true`, and the count, and stores nothing. A clear press on that listing gets the same answer.
- [x] The suspended and own-listing guards fire on a like press only. A clear press always removes the Install's own Anonymous Like. Test: suspended linked account with an existing Anonymous Like; the clear succeeds and a new like is refused.
- [x] Each new refusal code joins the shared codes export that ticket 01 made in the anonymous-likes config.
- [x] The server repo's `CONTEXT.md` gains **Claim**.
- [x] The guest `liked` flag is true when the linked account Likes the listing.
- [x] A token for an account that has not accepted the Privacy Policy is handled as a guest request on the anonymous route.
- [x] Tests: overlap; own listing; Claim twice; signed-out refusal after a Claim; suspended linked account; erasure removing the link; unchanged totals.

## Comments

### Built — 2026-09-20

One commit in FormamorphServer: `3d7ead0` "Claim A Guest's Likes On Sign-In", on top of `916571a`. The review findings are folded into the same commit rather than a follow-up, since nothing landed on the branch in between.

| Piece | File |
|---|---|
| `install_claims` table, `world_likes.claimed_at` | `src/schema/tables.js` |
| Step for a database that already has `world_likes` | `src/schema/steps/likeClaims.js` |
| Install and cascade indexes | `src/schema/indexes.js` |
| Claim transaction, link upsert, `accountFor` | `src/models/InstallClaim.js` |
| Claim handler | `src/controllers/userController.js` |
| Three guards, guest heart, mark cleanup | `src/controllers/worldController.js` |
| Three codes, shared no-Install body | `src/config/anonymousLikes.js` |
| **Claim** glossary entry | `CONTEXT.md` |
| 22 new tests | `tests/anonymousLikes.test.js` |

**Gates.** The server repo has no lint or type config, so `npm test` is the only gate. Full suite green: 1641 passed, 51 files, 53s.

**Guards.** Eighteen, each removed in turn with its test watched go red. None survived.

### Contract notes for the later tickets

- Route: `POST /api/users/me/anonymous-likes/claim`, `protect` only, no body. The Install arrives in the same header the guest route reads. Answers `{ success: true, data: { claimed } }`, where `claimed` counts only the marks that became Likes. `400` with `install_header_invalid` when the header is missing or malformed.
- **Not gated by the `anonymous_likes` setting.** Switching it off stops new marks and keeps stored ones counted, so somebody who liked before the switch must still be able to take their likes with them.
- New codes are `anonymous_likes_account_suspended`, `anonymous_likes_account_own_listing` and `anonymous_likes_account_already_liked`. "Account", not "linked": this server already uses *linked accounts* for accounts that share an address. The first two are `403`; the third is a `200`.
- This route now keeps `400` for a malformed request and `403` for a press the Install may not make. The account route answers its own-listing refusal with `400`, so the two differ on purpose.
- For ticket 04: the marker is `world_likes.claimed_at`, null on a like given as an account. The Like's `created_at` stays the first press, so `GET /api/users/:id/likes` already returns the original time as `likedAt`.

### Two things worth carrying forward

**A double count the review caught.** One person could hold two of a listing's likes with no way back: mark it while signed out, then like it on the account route, which cannot see the Install. The already-Likes guard then answered every clear without touching the mark, so the listing read 2 until the next sign-in ran a Claim. Reproduced through the public routes, then fixed: once the account holds the Like, any press from its own Install clears that Install's mark, whichever way the heart went.

**`world_likes` was missing from the boot-schema drift guard.** A column added to it would have reached a fresh database and never an existing one, and the guard could not have caught it. The table is in the guard's oldest shape now. Ticket 04 touches the same table.
