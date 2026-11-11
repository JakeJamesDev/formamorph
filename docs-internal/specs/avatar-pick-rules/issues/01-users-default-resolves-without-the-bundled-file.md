# 01: User's Default Resolves Without the Bundled File

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The resolver is the seam every other ticket reads. It changes what a player sees, so the order and each fallback need care.

## What to build

In play, an Avatar choice resolves by one rule, and the bundled Avatar file is never the answer (spec, The resolver; Q4).

- User's Default shows the marked Default Avatar when the library holds it, then the first available library Avatar, then no Avatar.
- "First available" keeps the order Avatar Customization preselects in today.
- A library pick whose model is gone resolves as User's Default.
- The bundled-file source is removed. Only seeding reads the bundled file.
- The viewer shows no Avatar when its source resolves to none or fails to load.
- A world pick the store lacks is unchanged.
- Update the Avatars wiki page where it says what User's Default shows.

## Acceptance criteria

- [ ] An entity on User's Default shows the marked Default Avatar when the library holds it.
- [ ] With no Default Avatar marked, it shows the first available library Avatar, in the order Avatar Customization preselects.
- [ ] With an empty library, it shows no Avatar, and the bundled file is not requested.
- [ ] A library pick whose model is gone shows what User's Default shows.
- [ ] A library Avatar that fails to load shows no Avatar, not the bundled one.
- [ ] A table test covers each pick against each library state: marked and present, marked and missing, unmarked with Avatars, empty.
- [ ] Mutation: restore the bundled fallback, and the empty-library test fails.

For you: play a world with an entity on User's Default after you delete the bundled Avatar. The entity shows your first Avatar, or none.
