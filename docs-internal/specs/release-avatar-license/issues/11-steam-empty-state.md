# 11: Steam Empty State

Status: done
Blocked by: 10
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

UI on a state only the Steam switch can reach, so it needs a dev route.

## What to build

A player with no Avatars sees why the Avatar surfaces are empty and has a clear way to add a `.vrm`. This covers the Model Library, the Avatar viewer and the Player Avatar dropdown in character creation. Use the design system's empty-state pattern, and write the copy from the Writing Guide. Each surface gets a dev route that shows the empty state.

A player can also hold added Avatars with no device default. The viewer then shows no model on User's Default, so it says how to set a default in place of a blank canvas.

The library's delete confirmation says saves will use the Default Avatar instead. With no bundled file, those saves show no model, so the confirmation says that on these builds.

Rulings: Q18.

## Acceptance criteria

- [x] Each surface shows its empty state with no Avatars, and shows the normal view after one is added. Library and Avatar Customization: DOM and frames on `avatars=none`; Customization adds one: `CharacterCustomization.emptyState.test.tsx` "shows the preview once one is added". The library's normal view after an add is the unchanged grid, not covered by a new test.
- [x] The add action in the empty state opens the same flow as the library's add action. Library: the button clicks `modelImportRef`, the toolbar's Import Avatar input. Customization: the button clicks its own Add .vrm input (test "opens the file picker").
- [x] Character creation still completes with no Avatar. Test "finalizes with no Avatar" (`chosenVrm` null); mutation-checked.
- [x] The delete confirmation's wording matches the build, tested with the flag at `none` and at its other values. `libraryVrmDelete.test.ts`, both `hasBundledDefault` states; the default reads `BUNDLED_DEFAULT_URL`.
- [x] `src/lib/devRoutes.ts` reaches each empty state. `avatars=none` and `avatars=lockedMissing` (`avatarSets`).
- [x] A changelog fragment is added.
- [ ] Frames at 1366 and 375, both themes: `.scratch/frames/empty-library-light.png`, `.scratch/frames/empty-library-dark.png`, `.scratch/frames/empty-library-mobile.png`. Light and dark at 1366 and dark at 375 are stored; the browser pane scaled the 1366 frames to 800 wide, and there is no light frame at 375.

For you: the empty-state wording, in the frames above.

## Landed

**Not verified**
- Frames at 375 in the light theme, and the pane's 1366 frames are scaled to 800 wide.
- The delete wording's "your default Avatar" is true for saves through User's Default and a gone chosen Avatar (`vrmResolver.steamAvatarSwitch.test.ts` "falls through a save's gone default id to the device default"). A library entity that names a deleted Avatar shows none, and the entity line says so.
- No production build was inspected for `setDevAvatarSet`; the body is guarded by `import.meta.env.DEV`, and the dev router and `installDevAvatars` are loaded only behind it.

**Spec notes**
- The ticket's "viewer shows no model on User's Default, so it says how to set a default" paragraph did not apply. In game the entity view hides when no source resolves, and Avatar Customization starts on the first library Avatar through `pickerStart`. Ruled with the spec session: the only blank viewer is a locked world pick naming an Avatar the library lacks, so Customization shows "This world's Avatar isn't available." there. The review found the first wording ("isn't in your library") also wrong for a pick missing from the world's own store, so it names neither place. Tested both ways.
- `EmptyListHint` says "Use the + button", so the empty state is a new `AvatarEmptyState`: the existing `Hint` plus an outline `Button`.
- Export shape: unchanged.
- Typecheck was red at the base in `FormaquestionMascotTab.publish.test.tsx` line 55 (`Uint8Array` not assignable to `BlobPart`). The spec session approved a type-only cast on that line, in this commit. Drop it if main has fixed the line.

**For you**
- The empty-state wording: `.scratch/release-avatar-license-11/frames/empty-library-dark.png`, `empty-library-light.png`, `empty-library-mobile.png` and `empty-creation-dark.png`.
- The Import Avatar button under the hint is a new pairing of the Hint and a Button; confirm the look. Open `#dev?view=mainMenu&tab=models&avatars=none` or `#dev?modal=avatar&avatars=none` on a fresh page load.
