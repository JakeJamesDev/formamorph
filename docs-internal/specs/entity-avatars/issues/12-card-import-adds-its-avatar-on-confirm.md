# 12: Card Import Adds Its Avatar on Confirm

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: the import flow has to hold the embedded Avatar until the review confirms, across the World Editor's import review.

## What to build

Importing a card adds its embedded Avatar to the Avatar library only when the import is confirmed (spec: Post-Close Rulings, Q28). Today the World Editor's card import adds the Avatar before its import review opens, so canceling the review leaves the Avatar in the library. Hash reuse on confirm stays as in T07-3.

## Acceptance criteria

- [ ] Canceling the World Editor's import review leaves the Avatar library unchanged.
- [ ] Confirming adds the Avatar once (hash reuse) and points the pick at it, then embeds it into the world store per T06-2.
- [ ] Main Menu card import keeps its current behavior.
- [ ] Tests cover cancel and confirm, and fail when the add moves back before the review.
- [ ] Changelog fragment.
