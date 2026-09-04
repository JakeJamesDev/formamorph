# 05 — Android update plugin and the Update Bridge accessor

Status: ready-for-agent
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
