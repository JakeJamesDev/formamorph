# 01: User's Default Resolves Without the Bundled File

Status: done
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

- [x] An entity on User's Default shows the marked Default Avatar when the library holds it. `vrmResolver.test.ts`, table rows "Default marked and present".
- [x] With no Default Avatar marked, it shows the first available library Avatar, in the order Avatar Customization preselects. Table rows "unmarked with Avatars", plus "takes the seeded bundled copy over newer Avatars" and "takes Praline only when she is the only Avatar". Both use `pickerStart`'s order through `firstAvailableAvatar`.
- [x] With an empty library, it shows no Avatar, and the bundled file is not requested. Table rows "empty"; `GamePanels.legacyAvatar.test.tsx` "shows no Avatar … the library is empty" (no viewer, no model read); `VRMViewer.steamAvatarSwitch.test.tsx` requests nothing with no URL on all three Avatar sets.
- [x] A library pick whose model is gone shows what User's Default shows. Table rows "a library Avatar that is gone" match the User's Default rows in every state.
- [x] A library Avatar that fails to load shows no Avatar, not the bundled one. `GamePanels.legacyAvatar.test.tsx` "fails to load" (the viewer gets no URL); `useVrmSourceUrl.test.ts`.
- [x] A table test covers each pick against each library state: marked and present, marked and missing, unmarked with Avatars, empty. `vrmResolver.test.ts` "each pick against each library state": four picks × four states, through both `resolveEntityVrm` and `resolvePlayedVrm`.
- [x] Mutation: restore the bundled fallback, and the empty-library test fails. Ran it: 8 red, including every "empty" row. Restoring the viewer's default URL reds the viewer test. Feeding an empty library during the read reds "holds a loader … while the library list is read".

## Landed

**Not verified**

- None.

**For you**

- Play a world with an entity on User's Default after you delete the bundled Avatar. The entity shows your first Avatar, or none.
- While a game loads, an entity on User's Default holds a loader for a moment, then shows its Avatar. With an empty library, the loader ends in no Avatar. Look at the entity view in the left panel.
