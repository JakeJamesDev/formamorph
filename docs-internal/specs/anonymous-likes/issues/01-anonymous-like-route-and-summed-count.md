# 01: Anonymous Like route and summed count

Status: ready-for-human
Status note: Built in FormamorphServer as 48dd31d, with the review findings folded in as 1127ce1. `Base:` below is the claim-time pointer in this repo; the server-side base is 9f1838e.
Base: b37a29e7
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Repo: FormamorphServer
Spec: ../spec.md (Implementation Decisions › Server)

Model rationale: new table, new route, and a count change that reaches four read paths and the sort. One wrong join changes every public number.

## What to build

A request with an Install header and no token sets or clears an **Anonymous Like** on a listing. A new setting gates the route and is off by default. Every public count becomes the sum of account Likes and Anonymous Likes. A guest request that carries an Install header gets its `liked` flag.

The cap, the Claim, and the linked-account guards are tickets 02 and 03. This ticket leaves room for them and builds none of them.

## Acceptance criteria

- [x] A new table holds Anonymous Likes: listing, Install id, address hash, browser family, created time. One row per listing and Install. It cascades with the listing. The schema step is idempotent.
- [x] The hash uses the Signal salt, the shared client-address resolution, and the shared browser-family function.
- [x] The route answers with the liked state and the summed count, in the shape the account like route returns.
- [x] The route refuses, each with a distinct code: setting off; listing not visible (the existing visibility check); missing or malformed Install header.
- [x] Setting it twice and clearing it twice are both safe.
- [x] The sum appears in the catalog select, the single-listing count, the Likes sort, and the author totals. Author totals keep their public-only rule.
- [x] The staff Likers list and the likes-given list stay account-only.
- [x] A guest catalog or detail request with an Install header gets `liked`; without the header the flag stays absent.
- [x] The Install header is on the CORS allow list, and responses that read it vary on it. A preflight test proves it.
- [x] A route limiter keyed by client address covers the account like route and the new route.
- [x] The new setting is declared with a validator and defaults to off. No public settings read is added.
- [x] The catalog list response and the listing detail response each carry a top-level `anonymousLikes` boolean that follows the setting, the same for every viewer. A test proves it on both.
- [x] With the setting off, stored Anonymous Likes still count.
- [x] Tests run through HTTP over the in-memory database. Each guard has a test that fails when the guard is removed.

## Comments

### Built — 2026-09-20

Two commits in FormamorphServer: `48dd31d` "Add Anonymous Likes" and `1127ce1` "Fold The Anonymous Likes Review Findings In". The second is a follow-up rather than an amend because a parallel Contest Ties session committed on top of the first before the review finished.

| Piece | File |
|---|---|
| `anonymous_likes` table | `src/schema/tables.js` |
| Model | `src/models/AnonymousLike.js` |
| Install header, refusal codes, setting validator | `src/config/anonymousLikes.js` |
| Shared like budget | `src/config/likeLimit.js` |
| Route and limiter | `src/routes/worlds.js` |
| Handler, guest `liked`, `anonymousLikes` flag, `Vary` | `src/controllers/worldController.js` |
| Summed count, new `accountLikeCount` | `src/models/World.js` |
| 36 tests | `tests/anonymousLikes.test.js` |

**Gates.** The server repo has no lint or type config, so `npm test` is the only gate. Full suite green: 1595 passed, 51 files, 20.2s.

**Guards.** Each guard was removed in turn and the matching test watched go red. Twenty checked, none survived.

### Contract notes for the later tickets

- Refusal codes are `anonymous_likes_off`, `listing_not_visible`, `install_header_invalid` and `liked_invalid`, exported as `CODES`. The fourth is not in this ticket's list of three; a malformed body has to be refused regardless, and giving it a code keeps the route's contract uniform.
- The Install header is validated as a strict UUID and lowercased before storage. The client must send `crypto.randomUUID()` output and nothing else.
- `World.likeCount` is now the sum. `World.accountLikeCount` is the account-only number the staff lists use.

### Declined, with reasons

- **Staff removal returns the summed count.** Checked rather than assumed: `LikersDialog` decrements its own account total locally and passes the returned number to the card's public count, so the two surfaces already get the right number each.
- **Glossary entries.** Install, Anonymous Like and the changed Like entry are ticket 02; Claim is ticket 03. The spec session assigned them.
- **The sum is written three times** (`likeCount`, the catalog select, `authorTotals`). They are three structurally different queries. A shared fragment would read worse. A fourth counting site should reopen this.
