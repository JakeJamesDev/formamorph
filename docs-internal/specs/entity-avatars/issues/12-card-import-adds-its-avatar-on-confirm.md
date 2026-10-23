# 12: Card Import Adds Its Avatar on Confirm

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: the import flow has to hold the embedded Avatar until the review confirms, across the World Editor's import review.

## What to build

Importing a card adds its embedded Avatar to the Avatar library only when the import is confirmed (spec: Post-Close Rulings, Q28). Today the World Editor's card import adds the Avatar before its import review opens, so canceling the review leaves the Avatar in the library. Hash reuse on confirm stays as in T07-3.

## Acceptance criteria

- [x] Canceling the World Editor's import review leaves the Avatar library unchanged. `WorldEditor.libraryAvatars.test.tsx` "leaves the Avatar library unchanged when the review is canceled".
- [x] Confirming adds the Avatar once (hash reuse) and points the pick at it, then embeds it into the world store per T06-2. "adds the Avatar on confirm…" and "reuses the library record…".
- [x] Main Menu card import keeps its current behavior. `importCharacterFile` defaults to adopt at read; the `entityVrmCarry.test.ts` card import tests still pass.
- [x] Tests cover cancel and confirm, and fail when the add moves back before the review. With `deferVrm: false` the cancel and confirm tests both failed (`expected 1 to be +0`).
- [x] Changelog fragment. `docs-internal/changelog.d/entity-avatars-12.md`.

## Landed

**Not verified**
- None. No browser check: jsdom drives the real import dialog.

**For you**
- The new changelog line sits next to the unreleased Entity Avatars import entry. Fold or drop it at release if it reads as churn.
