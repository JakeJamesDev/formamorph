# 08: In-game like prompt

Status: ready-for-human
Status note: Built as `1aecd599`, review findings folded into the same commit (it was still HEAD and unpushed). Four gates green on it: typecheck 0 errors, lint 0 errors, 12 052 tests pass in 153 s, build succeeds. Verified live on `#dev?view=gameViewer&fixture=whiteRoom&modal=likePrompt`, both themes and at 375x812. The review found two traps, both now covered by tests that fail when reverted: a 500 or 429 read as "listing gone" and spent the one ask, and the card never returned within a session because its read effect keyed on a listing id the trigger kept re-setting.
Base: 000ba0ef
Blocked by: 06
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Repo: formamorph
Spec: ../spec.md (User Stories › The in-game prompt)

Model rationale: new UI inside the largest view in the app, with seven ways not to show and three ways to fail.

## What to build

A player who reaches 15 turns in a world downloaded from the community sees one small card that asks if they enjoy it, with a heart. It shows once per listing, to guests and signed-in players.

## Acceptance criteria

- [x] A pure eligibility function takes the world record, the turn count, the online state, and the prompted marks, and returns show or not.
- [x] Eligible means: the world has a source listing id and a downloaded time, is not a bundled world, and the listing is not marked prompted.
- [x] The trigger is the post-turn commit with 15 or more derived total turns. A save loaded past 15 turns prompts after the next turn, not on load. The threshold is one named constant.
- [x] The card checks the listing's liked state first. An already-liked listing is marked prompted and the card does not show.
- [x] The heart writes an account Like for a signed-in player and an Anonymous Like for a guest.
- [x] The prompted mark lives in app storage keyed by listing id, outside the world record and the save. No export shape changes.
- [x] The mark is set on like, on dismiss, and on a not-visible or own-listing refusal. It is not set on a network failure or a cap refusal.
- [x] Offline, the card does not show. With the server setting off, a guest gets no card. The card reads the setting from the `anonymousLikes` flag on the detail response it already fetches.
- [x] The card is non-blocking, follows the once-only notice pattern, and respects reduced motion.
- [x] A dev-router entry reaches the card in one `goto`. The drift guard stays green.
- [x] Copy follows the player-facing voice and the help-copy pattern.
- [x] Changelog In-Progress entry, 👤 bucket.
- [x] Tests: the eligibility function across every rule; a component test for like, dismiss, the already-liked skip, and the failure path that leaves the mark unset.
- [x] Verified in the preview with static frames, both themes.
- [x] Four gates green.

## Notes on two criteria

**"The mark is set on ... a not-visible or own-listing refusal."** The press routes refusal codes through
the shared `refusalAnswer` map in [anonymousLikes.ts](../../../../src/lib/anonymousLikes.ts) rather than a
second switch, because a second switch had already diverged from it in review. That map groups
`listing_not_visible` and `anonymous_likes_account_own_listing` with `anonymous_likes_account_suspended`
and the two malformed-request codes under `silent`, so those three also mark. Each is a guard the player
cannot act on, so marking them matches the rule's intent. The two the ticket rules out, a network failure
and the cap, still leave the mark unset.

**"An already-liked listing is marked prompted and the card does not show."** An own listing is handled
the same way for a signed-in reader: `fetchListingLikeState` compares the listing's author against the
session, so an author is never shown the card at all rather than discovering it on the press. A guest has
no account to compare, so their own listing stays the server's to refuse, as the spec designs.

