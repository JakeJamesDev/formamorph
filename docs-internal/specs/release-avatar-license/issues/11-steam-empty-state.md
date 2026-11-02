# 11: Steam Empty State

Status: ready-for-agent
Blocked by: 10
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

UI on a state only the Steam switch can reach, so it needs a dev route.

## What to build

A player with no Avatars sees why the Avatar surfaces are empty and has a clear way to add a `.vrm`. This covers the Model Library, the Avatar viewer and the Player Avatar dropdown in character creation. Use the design system's empty-state pattern, and write the copy from the Writing Guide. Each surface gets a dev route that shows the empty state.

A player can also hold added Avatars with no device default. The viewer then shows no model on User's Default, so it says how to set a default in place of a blank canvas.

Rulings: Q18.

## Acceptance criteria

- [ ] Each surface shows its empty state with no Avatars, and shows the normal view after one is added.
- [ ] The add action in the empty state opens the same flow as the library's add action.
- [ ] Character creation still completes with no Avatar.
- [ ] `src/lib/devRoutes.ts` reaches each empty state.
- [ ] A changelog fragment is added.
- [ ] Frames at 1366 and 375, both themes: `.scratch/frames/empty-library-light.png`, `.scratch/frames/empty-library-dark.png`, `.scratch/frames/empty-library-mobile.png`.

For you: the empty-state wording, in the frames above.
