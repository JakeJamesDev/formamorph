# 03: New Game With No Avatar

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

The flow already skips the Avatar step for None. This adds two more cases on the resolver from ticket 01.

## What to build

A new game never asks a player to customize an Avatar they don't have (spec, Play; Q5).

- The new-game flow skips the Avatar step when User's Default resolves to no Avatar, as it does for None. The game starts with no Avatar.
- A library pick whose model is gone acts as User's Default: Avatar Customization preselects the resolved Avatar and offers the dropdown.
- With no Avatar shown, no customization controls render, the Animate Avatar checkbox included.
- None and a world Avatar behave as today.
- The library's delete confirmation still says a save "uses the Default Avatar" or "shows none". Make it match the resolver from ticket 01: the Default Avatar, then the first available Avatar, then none, with the same text on every build (spec, Library and seeding). Read the Writing Guide before you write it.
- Update the wiki text that describes the Avatar step of a new game.

## Acceptance criteria

- [x] With an empty library and a persona on User's Default, the flow goes past the Avatar step and the game starts with no Avatar. `EnterWorldFlow.avatarStep.test.tsx`, "skips the step on User's Default when the library is empty".
- [x] With a missing library pick and Avatars in the library, Avatar Customization preselects the resolved Avatar and shows the dropdown. Same file, "preselects the resolved Avatar and offers the picker".
- [x] With a missing library pick and an empty library, the step is skipped. Same file, "skips the step for a library pick that is gone".
- [x] A None persona skips the step, as before. Existing "no avatar step" test.
- [x] A world Avatar shows as set with no dropdown, as before. Existing "hides the picker on the author's Avatar" test.
- [x] No customization control renders when no Avatar shows. `CharacterCustomization.emptyState.test.tsx`, "renders no customization controls until an Avatar shows", and the missing-world-Avatar case.
- [x] The delete confirmation for an Avatar a save uses names the first-available fallback, and no longer differs by build. `libraryVrmDelete.test.ts`.
- [x] Mutation: remove the empty-library skip, and its test fails. Ran it: 4 tests failed, line restored.

For you: delete every Avatar, start a new game, and check that the flow reads well with the step gone.

## Landed

**Not verified**
- The Start Game / Continue to Avatar button label can flash while the first library read runs. Not checked in a browser.
- The delete text says "your Default Avatar" while the seeded Avatar is also named "Default Avatar". Not checked with a player.

**For you**
- Delete every Avatar, start a new game, and check that the flow reads well with the step gone.
- Delete the Avatar of a persona's library pick, start a new game, and check the dropdown opens on your Default.
