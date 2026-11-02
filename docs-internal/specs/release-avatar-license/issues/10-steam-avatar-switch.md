# 10: Steam Avatar Switch

Status: ready-for-human
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Several code paths assume a bundled file exists, and a miss shows up only as a runtime error. No Steam build exists yet to catch one.

## What to build

A build with the flag set to `none` holds no `.vrm` file and runs without one. Every world plays, and a save or world that names the default Avatar id resolves to no model with no error. That includes Sugarscape's User's Default pick.

This adds `none` to ticket 07's `FORMAMORPH_AVATARS` flag, which the Steam effort will set. Building the Steam build itself stays out of scope. The output must leave out every `.vrm`, including the tracked default that `public/` copies into a dist.

With no bundled file, these change: the viewer's default model URL, library seeding, the bundled hash check, and the rule that the library keeps at least one Avatar. Ticket 11 owns the empty-state UI, so this ticket leaves those surfaces functional and unstyled.

A player can still add a `.vrm` and play with it.

Rulings: Q18, Q19.

## Acceptance criteria

- [x] A build test asserts the Steam output holds no `.vrm`. Leaving one in turns it red, and that run is recorded in the Landed notes. `bundledAvatarCheck.test.mjs` on real Vite builds; runs below.
- [x] With the switch on, no request for a bundled model is made, and seeding writes nothing. `ModelStorageService.steamAvatarSwitch.test.ts`, `VRMViewer.steamAvatarSwitch.test.tsx`, and the browser probe: 0 `.vrm` requests.
- [x] A game starts and plays with no Avatar and no error, tested on the real resolver. `GameViewer.steamAvatarSwitch.test.tsx` plays a Sugarscape turn; the AI is stubbed.
- [x] Sugarscape's User's Default pick resolves to no model with no error. `vrmResolver.steamAvatarSwitch.test.ts` reads the real world file; the game test above covers the play.
- [x] The library can reach zero Avatars with the switch on, and can't with it off. `ModelStorageService.steamAvatarSwitch.test.ts` and the existing refusal case in `ModelStorageService.test.ts`; the browser probe stayed at zero after a reload.
- [x] An added `.vrm` is usable with the switch on. Game test and resolver cases; the browser probe stored a 19.5 MB file, set it as device default, and the viewer logged the load.
- [x] Non-Steam builds are unchanged, tested with the switch off. `vrmResolver.test.ts`, `ModelStorageService.test.ts`, `ModelStorageService.bundledAvatars.test.ts`, and the viewer's `''` and `nsfw` cases.

## Landed

`FORMAMORPH_AVATARS=none` builds hold no `.vrm` and run with no model. `BUNDLED_DEFAULT_URL` in `src/lib/defaultAvatar.ts` is the seam: it is undefined on `none`, and the viewer, resolver and library floor read it.

**The real app build:** `FORMAMORPH_AVATARS=none vite build` exited 0 with 0 `.vrm` files in the output.

**Leaving one in (red runs):**
- Strip off: "leaves the tracked default out of a Steam build" fails.
- A `.vrm` in a nested output folder: the build throws `models/deep/default-avatar.vrm is in the output`. Walking the top level only turns that test red.
- A `.VRM` of another name: the build throws. A case-sensitive walk turns that test red.

**Other mutation runs, each red on the expected test:** strip on every set, `none` holding the default, resolver keeping the file, resolver dropping the file on every build, resolver dropping the seeded record, floor kept on `none`, floor gone everywhere, viewer loading with no URL, viewer default URL gone, spinner with no URL, no spinner at all, seed ignoring the pick, device default ignored.

**Coverage, measured before the review fold-ins, on the ticket's tests alone:** `bundledAvatarCheck.mjs` 100% lines; `defaultAvatar.ts` 100%; `vrmResolver.ts` 96%; `useLibraryAvatars.ts` 59%, with `useLibraryIds` covered by other files.

**Browser probe:** the real app in Chromium on the dev server with the flag set. It covered first launch, the `entityAvatars` game fixture on an empty library, adding a file, the same game with it as device default, and deleting to zero. It logged no `.vrm` request, no page error, and no console error apart from the probe's own dead AI endpoint.

**Changes beyond the ticket's text**
- Spec ruling: User's Default on `none` shows no model until a device default or save pick names an Avatar. A record already at `default-avatar` still resolves.
- The save-load seed now counts a pick on its own, because on `none` an unread library resolves that pick to nothing. The result is the same on every other build.
- The build check now walks the whole output on every set. A stray `.vrm` on an SFW or NSFW build fails too. None exists today.
- No changelog fragment, by the spec session's agreement. No Steam build exists, and ticket 11 carries the player-facing line.

**Named, not fixed**
- The delete confirmation's "They'll use the Default Avatar instead" is false on `none`. Ticket 11 owns it.
- With no URL, the viewer shows an empty scene with no spinner. Ticket 11 explains that state.
- Packaging a Steam build stays with the Steam effort. `electron-builder.yml` ships `dist/**/*`, so the output check covers the app files it takes today.

**Not verified**
- Nothing unticked. No real AI ran on `none`: the game test stubs it, and the probe's endpoint is dead.

No export-shape change: saves and worlds keep their fields.
