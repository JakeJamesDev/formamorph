# 07: Praline In The Library

Status: ready-for-human
Blocked by: 05, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Seeding runs once per player and can't be redone, so its order and flags need care. Ticket 10 builds on the seam made here.

## What to build

On an NSFW build, a player's library holds Praline, and starting Sugarscape's Custom Persona offers her in the Player Avatar dropdown. On an SFW build she doesn't exist and is never fetched.

- **Seeding:** becomes a list of bundled entries, each with a fixed library id and its own one-shot flag. Existing players on NSFW builds gain Praline and keep their current default. A deleted Praline stays gone.
- **Build flag:** a build flag decides whether Praline exists, not a failed fetch. This ticket owns the flag's shape, and ticket 10 extends it for the Steam build.
- **Release swap:** the desktop, web and Android steps copy her file in. Pages stays without her.
- **Hash check:** the default-Avatar check includes her, so her unedited file can't be published.
- **Sugarscape:** the Custom Persona gains `vrmPick: { kind: 'default' }`. Use the `bundled-worlds` skill for the edit. The world file is the same on every build.

Existing players don't receive Sei (Q25).

Rulings: Q6, Q20, Q21, Q25.

## Acceptance criteria

- [x] Each entry seeds once, and a deleted one stays gone after a reload. `ModelStorageService.bundledAvatars.test.ts`, seeding on an NSFW build.
- [x] An existing library gains Praline and keeps its default. Same file, existing library cases, including a deleted default. Resolver cases in `vrmResolver.test.ts`.
- [x] An SFW build makes no request for her file, tested on the build flag and not on a 404. Same file: her file answers ok and is never requested, for seeding or the hash check. Her flag stays unset, so a later NSFW build seeds her.
- [x] A built SFW output holds no Praline file, and a built NSFW output holds both models. `bundledAvatarCheck.test.mjs` on real Vite builds. By hand on the app: `FORMAMORPH_AVATARS=nsfw vite build` held both, and an unset build holding her exited 1.
- [x] Publishing her unedited file is refused by the hash check. `avatarPublish.praline.test.ts` on the real file, seeded and re-imported after a delete. An edited copy passes.
- [x] Starting Sugarscape offers the library picker, and picking Praline makes her the played Avatar. Tested on the real resolver. `sugarscapeWorld.test.ts`, the Player Avatar.
- [x] A changelog fragment is added. `docs-internal/changelog.d/release-avatar-license-07.md`.
- [x] Frame: `.scratch/frames/sugarscape-picker.png`, the Player Avatar dropdown with Praline listed, at 1366. Playwright on the real entry flow, on the tracked Aki with Praline seeded from `build-assets`.

The response must carry the export-shape reminder: the bundled Sugarscape world gains a `vrmPick`.

For you: choose Praline in Sugarscape on a release build and play a few turns.

## Landed

`FORMAMORPH_AVATARS=nsfw` is the build flag, set only by the three release steps. Unset means SFW. `scripts/bundledAvatarCheck.mjs` fails a build whose output disagrees. Ticket 10 adds `none` in two places: `bundledAvatarsFor` and `AVATAR_SETS`.

**Changes beyond the ticket's text**
- Spec ruling (Q6): a missing device default now resolves to the seeded `default-avatar` record when the library holds it, else the file. This changes every world on User's Default, and a library pick whose id is gone. An existing player keeps seeing their old copy, a new install sees the same Sei, and the file serves only a deleted record.
- The publish refusal now reads "This Avatar comes with Formamorph. Upload your own VRM.", because "the default avatar" was wrong for Praline.
- `pickerStart` skips Praline when it falls back to the first record, so her being newest moves no one's start.
- Seeding now treats a status that isn't ok as a failure, so a host's 404 page can't be stored as a model.

**Named, not fixed**
- The build check tests that files exist, not which file. A release that sets the flag and skips the default swap would pass it. Only the string test on `release.yml` guards the copy lines.
- Seeding isn't single-flight. `MainMenu` and `CharacterCustomization` can overlap, and a delete during that window could be undone. The race predates this ticket and the window is narrow.
- On an SFW build the client hash check skips her, including a record left by an NSFW build on the same profile. The server catches her after ticket 08.

Mutation runs, each red on the expected test: shared flag, flag ignored, default seeded first, picker on the newest, 404 treated as ok, hash check missing an entry, Sugarscape without the pick, build check off, old resolver fallback. Coverage wasn't measured.

`npm run fingerprints` still crashes on a cold cache. Sugarscape's fingerprints don't change with this edit: both forms were already listed, because the fingerprint reads long text only.

**Not verified**
- Nothing unticked. The frame ran on the dev server with Aki, not on a release build.

**For you**
- For you: choose Praline in Sugarscape on a release build and play a few turns.
- The frame: `.scratch/release-avatar-license-07/frames/sugarscape-picker.png`.
- The refusal copy above is new wording. Change it if you prefer other words.
