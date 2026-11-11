# 03: New Game With No Avatar

Status: ready-for-agent
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

- [ ] With an empty library and a persona on User's Default, the flow goes past the Avatar step and the game starts with no Avatar.
- [ ] With a missing library pick and Avatars in the library, Avatar Customization preselects the resolved Avatar and shows the dropdown.
- [ ] With a missing library pick and an empty library, the step is skipped.
- [ ] A None persona skips the step, as before.
- [ ] A world Avatar shows as set with no dropdown, as before.
- [ ] No customization control renders when no Avatar shows.
- [ ] The delete confirmation for an Avatar a save uses names the first-available fallback, and no longer differs by build.
- [ ] Mutation: remove the empty-library skip, and its test fails.

For you: delete every Avatar, start a new game, and check that the flow reads well with the step gone.
