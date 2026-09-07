# 06 — Exports via Save As

Status: ready-for-human
Type: task
Blocked by: 04
Spec: ../spec.md (Implementation Decisions › Exports on Android)

## Task

- Use Capacitor Filesystem for staging and a native document-picker plugin for Save As.
- In the single download helper: when the Android bridge exists, stage the blob in a unique cache file and open Save As; copy to the chosen destination and clean up staging; otherwise keep the anchor path. Callers unchanged.
- Confirm imports (world, save, card, VRM) work through the normal file input on the phone.
- Changelog In-Progress entry, 👤 bucket.

## Acceptance

- One test file covering the anchor path and the Save As path with a fake bridge.
- On the phone: world JSON, a save, and a character card each open Save As, save to Downloads, and reimport intact. Cancellation stays quiet.
- Four gates green.

## Current verification

The September 7 phone check found that the share sheet had no save-to-storage target. Save As replaces it using `ACTION_CREATE_DOCUMENT`, with the export filename and MIME type supplied to Android. Native tests cover exact bytes, source confinement, and write failures; bridge tests cover staging, errors, and cleanup. A new signed APK still needs the phone round trip in ticket 10.

- Bridge: 10 tests passed in 5.29 seconds; 100% lines and branches in `downloadBlob.ts`.
- Native: 4 export tests passed; final native tests and unsigned APK build completed in 9.26 seconds after Android sync (19.83 seconds). `ExportFiles.kt` has 100% line and branch coverage. The picker plugin has 0% JVM coverage and awaits device verification.
- Mutation checks: bypassing Save As failed 5 bridge tests (4.83 seconds); removing source confinement failed the native boundary test (2.85 seconds). Both sources were restored exactly and their tests passed again.
- Final gates all exited 0: typecheck (16.75 seconds), lint (13.81 seconds), full suite (55.46 seconds; 8,463 passed, 3 skipped), and web build (18.36 seconds). The MainMenu teardown errors are resolved by the separate handoff work.
- Code graph updated. Export payload shapes and app version are unchanged.

## Earlier implementation notes

**2026-09-04 — implemented.** `src/lib/downloadBlob.ts` now branches on `Capacitor.isNativePlatform()`:
it stages the blob in `Directory.Cache` as base64 and calls `Share.share({ files: [uri] })`, and keeps the
anchor path everywhere else. Every caller is unchanged, and `downloadBlob` is still the only download path
in `src/` — nothing else builds an anchor with a `download` attribute.

Three things the diff does not explain.

- **The Filesystem plugin takes base64, not a Blob, on native.** `WriteFileOptions.data` is typed
  `string | Blob`, but the plugin's own doc comment reads "Blob data is only supported on Web", so the
  helper reads the blob through `FileReader.readAsDataURL` and cuts the prefix.
- **A dismissed share sheet rejects like a failure.** `SharePlugin.java` calls
  `call.reject("Share canceled")` on `RESULT_CANCELED`, so the helper matches that one message and stays
  quiet. Without the match, closing the sheet raised an error toast; a test pins it.
- **The name becomes one path segment.** A world named with a `/` would otherwise read as a cache
  subdirectory. Separators become `-` before the write.

The plugins are `@capacitor/filesystem@8.1.3` and `@capacitor/share@8.0.1`, both live latest on the day.
Ticket 04 carried the `package.json` entries and the regenerated Gradle wiring into its own commit, because
the lock file could not be split between the two sessions.

**Left for ticket 10's device checklist.**

- Export a world JSON, a save, and a character card on the phone; confirm each opens the share sheet and
  lands intact in Files.
- Import a world, a save, a card, and a VRM through the normal file input. Imports need no code change —
  every import is a plain `<input type="file">` — but **check the VRM picker specifically**: its
  `accept=".vrm,.glb"` names two extensions Android has no MIME type for, and the system picker may then
  offer nothing selectable. This is an import-side risk that predates the share sheet, not a regression.

**Review outcome.** Two findings applied: the failure toast now says `Could not share <name>.` in our own words
with the plugin's text left to `console.error`, and `downloadUrl` is no longer exported, so `downloadBlob` is
the only door. Three findings declined, with the reason.

- **"The Capacitor imports resolve to `devDependencies`."** That is this repo's convention, not a slip:
  `react`, `three`, `lexical`, and `vite` all sit in `devDependencies` too. Vite bundles them at build time
  and there is no `--omit=dev` install of this app.
- **"No caller passes a path separator, so the sanitizing test asserts a shape production never produces."**
  It does. `useWorldExport` takes the filename straight from `worldOverview.name`, so a world named with a
  `/` reaches the helper as one.
- **"`toBase64` duplicates `fileToDataUrl`."** True of the six-line FileReader idiom, which is already
  duplicated between `imageDrop.ts` and `imageBytes.ts`. Both are image modules, and a save path should not
  import either for boilerplate. Folding all three into one neutral helper is a repo-wide cleanup, named here
  rather than done in this ticket.

**Accepted behavior: staged exports stay in the cache.** Deleting the file after `share()` resolves would pull
it out from under a receiving app that reads the URI later, so the copy stays. Android reclaims the app cache
under storage pressure and the system's Clear Cache button empties it, which is the designed answer.
