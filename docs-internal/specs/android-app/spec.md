# Android App: Sideloaded APK With In-App Updates

Status: ready-for-agent

Formamorph ships on Android as a sideloaded APK that updates itself from GitHub Releases with the same footer flow desktop uses, and every platform gains a per-request version gate so a stale client learns which feature needs an update instead of failing silently. Designed in a grilling session on 2026-09-04.

**Ordering constraint.** Google requires a verified developer identity for sideloaded apps on certified devices from 2027 globally, and from 2026-09-30 in Brazil, Indonesia, Singapore, and Thailand. Verification is a manual identity process, so ticket 01 starts first and runs in parallel with everything else. The version gate (tickets 02 and 03) is platform-independent and ships with the next desktop release whether or not the APK is ready.

## Problem Statement

A player on a phone can only reach Formamorph through the browser. There is no icon on the home screen, exports do not save, and the game runs inside browser chrome. On desktop, every platform checks for updates and installs them with one click, so nobody is stuck on an old build without knowing it. A phone build would have none of that, and a player on an old build who hits a server feature that needs a newer client sees a generic failure and assumes the game is broken.

## Solution

The **Android App** is the web build wrapped in a WebView, distributed as an APK on GitHub Releases, the landing page, and itch.io. It is the whole app, unchanged: World Editor, VRM viewer, saves, imports. Local-engine features stay hidden exactly as they are on the web.

Updates reuse the desktop flow. The footer checks GitHub Releases, shows Update Available, and the player taps Download and then Install. Android shows its own install sheet, the player confirms once, and the app relaunches on the new version. The download is manual, on both the stable and beta channels, because the APK is about 90 MB.

Every platform gains a **Version Requirement**: each API request carries the client version and platform, and any route can answer that it needs a newer client. The client shows one **Update Dialog** naming the feature and the version required, with a button that runs the platform's update flow. Nothing else is blocked. A player on an old build keeps playing, keeps using local endpoints, and only meets the dialog on the one feature that outgrew their build.

Exports on Android open the share sheet. The hardware back button closes a modal, then goes back a view, then asks before leaving the app.

## User Stories

### Getting the app

1. As an Android player, I want a download button on the landing page, so that I can install the app without hunting through GitHub.
2. As an Android player, I want the APK on the GitHub release, so that I can install a specific version.
3. As an itch.io player, I want an Android channel on the itch page, so that I get the app where I already found the game.
4. As an Android player, I want the app to install on Android 7 and newer, so that an older phone still works.
5. As an Android player, I want the app icon and name to match the desktop app, so that I recognize it.
6. As an Android player, I want a wiki page that walks me through allowing installs from my browser, so that the first install does not stall on an Android prompt I do not understand.
7. As an Android player, I want the app to keep working after Google's developer verification rules take effect, so that my install does not stop one day.

### Playing

8. As an Android player, I want the whole app, editor included, so that I can author on the phone I have with me.
9. As an Android player, I want my saves, worlds, and settings to persist across app updates, so that updating never costs me progress.
10. As an Android player, I want the app to run fullscreen with no browser chrome, so that the game has the whole screen.
11. As an Android player, I want the app to open again where I left it after switching apps, so that a notification does not end my session.
12. As an Android player, I want to point the app at LM Studio on my home network over plain http, so that I can play against my own model with no internet.
13. As an Android player, I want the cloud endpoint and community to work exactly as on the web, so that nothing is missing on the phone.
14. As an Android player, I want the app to work with no connection for everything except AI turns and community, so that I can edit and read on a plane.
15. As an Android player, I want the local engine and model catalog to stay hidden, so that I am not offered something the phone cannot run.

### Exporting and importing

16. As an Android player, I want exporting a world to open the share sheet, so that I can send it to Files, Drive, or a friend.
17. As an Android player, I want exporting a save to open the share sheet, so that backups work on the phone.
18. As an Android player, I want exporting a character card to open the share sheet, so that cards reach other apps as images.
19. As an Android player, I want importing a world, save, card, or VRM to use the normal file picker, so that imports need no new steps.
20. As a desktop or web player, I want exports to keep working exactly as today, so that the Android path changes nothing for me.

### Updating on Android

21. As an Android player, I want the footer to show Update Available when a newer release exists, so that I learn about updates the way desktop players do.
22. As an Android player, I want to choose when to download the update, so that a 90 MB download never starts on mobile data without my say.
23. As an Android player, I want download progress in the footer, so that I know the update is coming.
24. As an Android player, I want the update to verify its checksum before installing, so that a corrupt download never reaches the installer.
25. As an Android player, I want a single Install tap after the download, so that updating is one confirmation, not a file-manager hunt.
26. As an Android player, I want the app to send me to the right Android setting when it is not yet allowed to install apps, so that the first update explains itself.
27. As an Android player, I want a downloaded update to survive an app restart, so that I never download the same version twice.
28. As an Android player, I want the beta channel to offer pre-release APKs, so that I can test early builds like desktop beta users.
29. As an Android player, I want the update check to fail quietly when offline, so that no connection never means an error wall.
30. As an Android player, I want the changelog in the update dialog, so that I know what changed before I install.

### The Version Requirement, every platform

31. As a player on an old build, I want a clear message naming the feature that needs a newer version, so that I know the game is not broken.
32. As a player on an old build, I want that message to name the version required, so that I can tell whether the update on offer is enough.
33. As a player on an old build, I want an Update button in that message that starts the platform's update flow, so that the fix is one tap away.
34. As a web player on an old build, I want that button to reload the page, so that the fix is instant.
35. As a player on an old build, I want everything else to keep working, so that one gated feature never locks me out of my saves or local play.
36. As a player on a current build, I want never to see the dialog, so that it is not nagware.
37. As a player, I want the dialog to appear once per feature, not once per failed request, so that a retry loop does not stack dialogs.
38. As a player, I want the privacy policy to say that requests carry my app version and platform, so that the new signal is disclosed.

### Operating

39. As staff, I want to set a minimum client version on one route without touching others, so that a moderation feature can require a newer client while play continues for everyone.
40. As staff, I want the minimum to be a server setting, so that raising it needs no deploy.
41. As staff, I want the server to log the client platform on requests, so that I can see how many Android installs exist.
42. As staff, I want the version-required reply to be one well-known code, so that every client handles it the same way.
43. As the maintainer, I want the APK built and signed in CI on every tag, so that Android releases cost nothing extra.
44. As the maintainer, I want the signing key stored as a CI secret and backed up outside GitHub, so that losing it never orphans every install.
45. As the maintainer, I want a tag that disagrees with the package version to fail the Android job like it fails the others, so that the APK's self-reported version always matches its tag.
46. As the maintainer, I want the APK's version code derived from the package version, so that Android always accepts a newer release as an update.
47. As the maintainer, I want a device checklist for the first release, so that the install sheet, Play Protect, and the update flow are proven on a real phone before players see it.
48. As the maintainer, I want the Android job to skip itch.io on pre-release tags like the others, so that beta APKs never replace the live channel.

## Implementation Decisions

### The Android App

- Capacitor wraps the web build. Application id `ai.formamorph.app`. This id is permanent.
- The APK contains the same web build as the desktop release, including the release avatar swap. The build class baked into the footer is `android`.
- Minimum Android version is Capacitor's default, Android 7.
- A network security config allows cleartext only to localhost and RFC 1918 ranges. Public endpoints stay https.
- The manifest declares the install-packages permission and nothing else beyond Capacitor's defaults. No storage permission: exports use the share sheet from the app's cache directory.
- Local-engine gating stays as it is. The desktop check remains false on Android, so the engine, model catalog, and desktop-only settings never show.
- Orientation is unlocked. The mobile keyboard handling already in the web build applies unchanged.

### The Update Bridge

- One accessor returns the platform's update bridge: the desktop bridge when present, an adapter over the Android plugin when present, otherwise none. The footer update control mounts when a bridge exists instead of when the desktop check passes. The web build still has no bridge and shows no update UI.
- Detection stays renderer-side in the update service. On Android it uses plain `fetch`, which the GitHub API permits cross-origin.
- The Android bridge takes the asset URL and checksum URL from the release the renderer already holds. It does not read GitHub itself, unlike the desktop main process.
- The Android plugin downloads the APK to the app's cache with progress events, verifies the SHA-512 sidecar, records the pending version, then on apply opens a PackageInstaller session, writes the file, and commits. Android shows its install sheet. A pending download that matches the newest release is offered as Install on the next launch, mirroring the desktop pending check.
- Before apply, if the app is not allowed to install packages, the plugin opens the Android setting for that app and returns; the footer keeps the Install button so the player taps again after allowing.
- The stable and beta channels apply unchanged. Pre-release tags are eligible only on beta.
- The release asset is named `Formamorph-android.apk` with a `Formamorph-android.apk.sha512` sidecar. The name carries no version so the landing page can use the GitHub latest redirect. The release tag already carries the version.
- Android version code is derived from the package version as major times one million plus minor times one thousand plus patch. A pre-release shares its stable version's code; Android accepts a same-code install as a reinstall.

### The Version Requirement

- Every request to the API server carries a `X-Formamorph-Client` header whose value is the version, a space, and the platform: one of `web`, `windows`, `linux`, `mac`, `android`. Only requests to the API server carry it.
- The header is added by a global `fetch` wrapper of the same shape as the privacy-refusal watcher, installed once at app start with the API base URL. It also inspects replies from that base for the version-required code and calls back with the feature name and minimum version. The response is returned untouched.
- The server answers `426 Upgrade Required` with a body of `{ code: "CLIENT_UPDATE_REQUIRED", minVersion, feature }` when the route's minimum exceeds the client's version. A missing header is treated as version zero, so an old build that never sent one still gets the reply. Requests with no gated route are unaffected.
- Minimums live in a server setting keyed by route, editable by staff, empty by default. The server logs platform and version per request at the same level it logs the rest of the request line.
- One Update Dialog owns the client side. It names the feature, shows the version required and the running version, and offers Update. Update runs the bridge flow where a bridge exists, and reloads the page on the web. The dialog de-duplicates on feature name until dismissed.
- The privacy policy gains one sentence about the header.

### Exports on Android

- The single download helper checks for the Android bridge. On Android it writes the blob to the cache directory and opens the share sheet with that file. Everywhere else it keeps the anchor download. All callers are unchanged.

### The back button

- A pure function maps the app's view state to one of three actions: close the top modal, go back one view, or confirm exit. A thin hook subscribes to Capacitor's back event and applies the result. The confirm-exit prompt reuses the existing confirm dialog.

### Build and release

- The release workflow gains an Android job on an Ubuntu runner: JDK, Android SDK, the same avatar swap, web build with the android build class, Capacitor sync, Gradle release build, signing from CI secrets, the checksum sidecar, and the tag-matches-version guard. Its artifacts join the one release.
- The itch.io desktop job gains an android channel push, skipped on pre-release tags like the others.
- The landing page gains an Android download button pointing at the GitHub latest redirect.
- The signing keystore is generated by the maintainer, backed up outside GitHub, and stored as CI secrets. A wizard script walks those steps.

## Testing Decisions

A good test drives the seam from outside and asserts what a player or the server would observe. Tests never reach into plugin internals or assert on which function was called.

- **Client identity wrapper.** Stub `fetch`. Assert the header on API requests and its absence elsewhere, the callback on a 426 with the code, no callback on other 426s or other bases, and that the response body is still readable by the caller. Prior art: the privacy-refusal watcher's tests.
- **Update bridge accessor and hook.** A fake bridge object. Assert the accessor picks desktop, then Android, then none; assert the hook resumes at downloaded when the pending version matches and drives download and apply through the bridge. Prior art: the update reducer tests and the update checker's existing coverage.
- **Update Dialog.** Render with a fake bridge and without. Assert the feature and version text, that Update calls the bridge or reloads, and that two refusals for one feature open one dialog. Prior art: the Privacy Policy prompt tests.
- **Export helper.** Assert the anchor path with no bridge and the share path with a fake Android bridge. One file covers both.
- **Back handler.** Pure function table: modal open, nested view, main menu. Assert the action per state.
- **Server.** In the server repo: a route with a minimum answers 426 with the body shape for an older client, passes a newer one, treats a missing header as zero, and leaves ungated routes alone.
- **Native plugin, install, CI.** No unit tests. Ticket 10 is a device checklist run on a real phone before the first tagged release: first install from the browser, the install-from-this-app setting, download progress, checksum failure on a tampered file, the install sheet, relaunch on the new version, data intact, beta channel, offline check, share sheet for each export kind, back button in each state.

## Out of Scope

- An on-device model. Phones that run one well are rare. Own effort if demand appears.
- A Google Play listing. The developer verification path chosen keeps it open.
- Auto-download on Wi-Fi. Manual is parity with desktop; revisit with install numbers.
- A nudge on the mobile web site pointing at the APK.
- iOS.
- Changing the desktop update flow.
- Any change to world or save export shape. This effort touches none.

## Further Notes

- Google's developer verification applies to sideloaded apps on certified devices. Registration is through the Google Play Console with a government ID and a fee; the hobbyist tier is capped at 20 devices and does not fit a public release. Ticket 01 is the maintainer's and gates nothing in code, but the first public APK should not ship before it is done.
- Play Protect warns on the first install from an unknown signer. A consistent key over releases reduces the warning. The wiki page tells players what the warning means.
- The APK weighs roughly what the web build weighs, about 90 MB, most of it the avatar and animation files. Trimming is a separate effort.
- Glossary candidates for the domain doc: Android App, Update Bridge, Version Requirement, Update Dialog.
- Build class `android` joins the existing set the footer displays. Confirm the footer copy for it in ticket 04.
