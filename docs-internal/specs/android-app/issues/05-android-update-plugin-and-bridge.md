# 05 — Android update plugin and the Update Bridge accessor

Status: ready-for-human
Status note: Renderer half is done and unit-tested; the Kotlin plugin and its Gradle changes have never been compiled, because this machine has no Android SDK. Acceptance bullet 2 is the maintainer's.
Type: task
Blocked by: 04
Spec: ../spec.md (Implementation Decisions › The Update Bridge; Testing Decisions)

## Task

- Add the bridge accessor: returns the desktop bridge, else an adapter over the Android plugin, else none. Change the footer update control's mount condition from the desktop check to "a bridge exists".
- Android adapter shape mirrors the desktop bridge: `pending`, `download({ url, sha512Url, version })`, `apply`, `onProgress`, `onDownloaded`. The renderer passes the asset and sidecar URLs from the release it already holds.
- Kotlin plugin: stream the APK to the cache directory with progress events, verify SHA-512 against the sidecar, delete on mismatch, record the pending version. `apply`: if installs from this app are not allowed, open the per-app unknown-sources setting and return `{ needsPermission: true }`; else open a PackageInstaller session, write the file, commit. Android shows its install sheet.
- Update hook: on `needsPermission` keep the state at downloaded so the Install button remains.
- Update service: pick the `Formamorph-android.apk` asset and its `.sha512` sidecar for the android platform.
- Changelog In-Progress entry, 👤 bucket.

## Acceptance

- Unit tests per the spec for the accessor and the hook against a fake bridge.
- On the phone: an older local build sees Update Available for the newest GitHub release, downloads with progress, installs through the sheet, relaunches on the new version with saves intact.
- Four gates green.

## Comments

### The Kotlin half is uncompiled

There is no Android SDK and no Android Studio on this machine, so no Gradle task can run. `UpdatePlugin.kt`,
the `kotlin-android` plugin, and the JVM-target block ship unbuilt. Every API in the plugin was read from
Capacitor 8.5.1's own source rather than recalled:

- `Bridge.callPluginMethod` posts to a background `taskHandler`, so plugin methods already run off the main
  thread. The download still gets its own executor, because holding that shared thread for a 90 MB file
  would stall every other plugin call.
- `JSObject.put` returns `JSObject` for every overload, so the chained calls compile.
- `Plugin.load()` and `Plugin.handleOnDestroy()` exist and are the hooks used.

The Kotlin Gradle plugin is pinned to 2.4.10, the newest stable on Maven Central (2.4.20-RC3 is a release
candidate). The JVM target had to be set to 21 because `capacitor.build.gradle` compiles Java against 21 and
Kotlin defaults to 8; Gradle fails a build outright when the two disagree.

Java would have needed none of those three Gradle lines. The ticket says Kotlin, so it is Kotlin — but the
first Android build anywhere is either the maintainer's or ticket 08's CI job, and this is what it will hit
first if anything is wrong.

### Detecting the plugin

The first draft read `window.Capacitor.Plugins.FormamorphUpdate` and would have shipped the update control
to the web build. Reading the installed `@capacitor/core` runtime showed why: `Plugins[name]` is written by
the JS `registerPlugin()` call on every platform, browser included. The native declaration is the only real
signal, and `Capacitor.isPluginAvailable(name)` is what reads it. Removing that check turns three accessor
tests red, including "finds nothing in the browser".

### The mount condition covers the ⋯ menu too

Changing only the left footer site would have left the Android version line collapsed into the mobile ⋯
overflow menu, because the Android app is always `isMobile`. Stories 21 and 23 both say "in the footer", and
ticket 10's checklist has a line for it. So a bridge now keeps the line inline and drops it from the ⋯ menu,
which also stops two update checkers mounting at once. Verified in the preview by DOM read:

| Case | Viewport | Bridge | Footer | ⋯ menu |
|---|---|---|---|---|
| Web, phone | 375x812 | none | copyright only | `v2.16.0 · dev` |
| Android | 375x812 | present | `v2.16.0 · dev` | Patreon / GitHub only |
| Web, desktop | 1280x800 | none | `v2.16.0 · dev` | not shown |

### Two deliberate additions beyond the task list

- `kind?: 'android'` on `UpdateBridge`, so the button reads **Install** rather than "Update & Restart".
  Nothing restarts on Android; the system installer takes over. Story 25 asks for a single Install tap.
- The footer's byte readout drops the total and the percent when the server sends no `Content-Length`.
  `contentLengthLong` returns -1 on a chunked response, which would have reached the footer as a size.

### Left open

- The three 👤 Android entries in the changelog (exports, updating, back button) now qualify for a grouped
  **Android App:** header under the changelog's own rule 5. Tickets 06 and 07 were still running, so their
  entries were left alone rather than restructured underneath one.
- `androidAssets` runs on every platform, not only Android. Harmless — the desktop bridge ignores the URLs —
  but the task's "for the android platform" qualifier is unexpressed in the code.
