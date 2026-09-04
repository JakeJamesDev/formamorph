# 06 — Exports via the share sheet

Status: ready-for-human
Type: task
Blocked by: 04
Spec: ../spec.md (Implementation Decisions › Exports on Android)

## Task

- Add the Capacitor Filesystem and Share plugins at live latest versions.
- In the single download helper: when the Android bridge exists, write the blob to the cache directory and open the share sheet with the file; otherwise keep the anchor path. Callers unchanged.
- Confirm imports (world, save, card, VRM) work through the normal file input on the phone.
- Changelog In-Progress entry, 👤 bucket.

## Acceptance

- One test file covering the anchor path and the share path with a fake bridge.
- On the phone: world JSON, a save, and a character card each open the share sheet and arrive intact in Files.
- Four gates green.

## Comments

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
