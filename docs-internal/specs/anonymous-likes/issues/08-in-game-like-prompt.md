# 08: In-game like prompt

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high
Repo: formamorph
Spec: ../spec.md (User Stories › The in-game prompt)

Model rationale: new UI inside the largest view in the app, with seven ways not to show and three ways to fail.

## What to build

A player who reaches 15 turns in a world downloaded from the community sees one small card that asks if they enjoy it, with a heart. It shows once per listing, to guests and signed-in players.

## Acceptance criteria

- [ ] A pure eligibility function takes the world record, the turn count, the online state, and the prompted marks, and returns show or not.
- [ ] Eligible means: the world has a source listing id and a downloaded time, is not a bundled world, and the listing is not marked prompted.
- [ ] The trigger is the post-turn commit with 15 or more derived total turns. A save loaded past 15 turns prompts after the next turn, not on load. The threshold is one named constant.
- [ ] The card checks the listing's liked state first. An already-liked listing is marked prompted and the card does not show.
- [ ] The heart writes an account Like for a signed-in player and an Anonymous Like for a guest.
- [ ] The prompted mark lives in app storage keyed by listing id, outside the world record and the save. No export shape changes.
- [ ] The mark is set on like, on dismiss, and on a not-visible or own-listing refusal. It is not set on a network failure or a cap refusal.
- [ ] Offline, the card does not show. With the server setting off, a guest gets no card. The card reads the setting from the `anonymousLikes` flag on the detail response it already fetches.
- [ ] The card is non-blocking, follows the once-only notice pattern, and respects reduced motion.
- [ ] A dev-router entry reaches the card in one `goto`. The drift guard stays green.
- [ ] Copy follows the player-facing voice and the help-copy pattern.
- [ ] Changelog In-Progress entry, 👤 bucket.
- [ ] Tests: the eligibility function across every rule; a component test for like, dismiss, the already-liked skip, and the failure path that leaves the mark unset.
- [ ] Verified in the preview with static frames, both themes.
- [ ] Four gates green.
