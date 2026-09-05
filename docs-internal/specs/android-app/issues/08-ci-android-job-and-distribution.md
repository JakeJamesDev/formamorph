# 08 — CI Android job, release assets, itch channel, landing page button

Status: ready-for-human
Status note: CI and Gradle are done and locally proven with a throwaway key. Left for a human: tag a pre-release and run the phone check in the acceptance list.
Type: task
Blocked by: 04, 05
Spec: ../spec.md (Implementation Decisions › The Update Bridge › asset naming; Build and release)

## Task

- Release workflow: Android job on an Ubuntu runner. JDK, Android SDK, avatar swap, web build with the android build class, `cap sync`, Gradle release build, sign from secrets, `Formamorph-android.apk` plus `Formamorph-android.apk.sha512`, the tag-matches-version guard. Attach both to the release.
- Version code from the package version: major × 1,000,000 + minor × 1,000 + patch. Pre-release suffix ignored.
- Secrets, already named by ticket 01's wizard: `ANDROID_KEYSTORE_BASE64` (PKCS12, base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Decode the keystore to the runner's temp dir and point Gradle's signing config at it.
- itch.io: add an android channel push to the desktop butler job, skipped on pre-release tags.
- Landing page: an Android button pointing at the GitHub latest redirect for the stable asset name.
- Changelog In-Progress entry, ⚙️ bucket.

## Acceptance

- A pre-release tag on a branch produces a signed APK on the GitHub pre-release and skips itch.
- The APK installs on the phone and its footer shows the tag's version and the android build class.
