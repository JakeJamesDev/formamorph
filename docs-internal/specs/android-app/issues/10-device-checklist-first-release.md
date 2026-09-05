# 10 — Device checklist before the first public APK

Status: ready-for-human
Status note: Run sheet written 2026-09-04. Needs a phone and two pre-release tags; every blocker is done.
Type: task
Blocked by: 01, 02, 03, 05, 06, 07, 08, 09
Spec: ../spec.md (Testing Decisions › Native plugin, install, CI)

Run on a real phone against a pre-release tag. Tick every line before the first stable tag with an APK.

## Checklist

- [ ] First install from the browser download: Android prompts to allow the browser, then installs.
- [ ] Play Protect warning, if any, reads as expected and the wiki page matches it.
- [ ] Main menu, bundled world, one cloud AI turn, one LAN http AI turn.
- [ ] Airplane mode: editor and saves work; update check fails quietly; no error wall.
- [ ] Footer shows Update Available against a newer pre-release on the beta channel.
- [ ] Download shows progress; app restart offers Install without re-downloading.
- [ ] Tampered sidecar: install refused, partial deleted, footer shows the error.
- [ ] First apply opens the unknown-sources setting; second apply opens the install sheet.
- [ ] Relaunch on the new version with saves, worlds, and settings intact.
- [ ] Version Requirement: a staff-set minimum on one route shows the Update Dialog naming that feature; everything else works; Update runs the download.
- [ ] Share sheet: world, save, character card each arrive intact in Files.
- [ ] Back: closes a modal, returns to the main menu, asks before exit.
- [ ] itch android channel updated on a stable tag; skipped on the pre-release.

## Run sheet

Every blocker is done as of 2026-09-04. The lines above need a phone, so this section prepares the run. Each step names the checklist lines it ticks. The order matters: the tamper test must come before the good download, and the Version Requirement test needs a newer release to hand to Update.

### Before the phone

1. **Secrets.** The four `ANDROID_*` secrets are set by hand (ticket 01). A missing one fails the Android job at "Decode the signing keystore", not on the phone.
2. **First pre-release.** Set `package.json` `version` to `2.17.0-beta.1`, commit, tag `v2.17.0-beta.1`, push the tag in GitHub Desktop. The tag must equal `v<version>` or the build fails fast. The notes step has no released section for a beta and falls back to the In-Progress bucket; that is expected.
3. **Confirm the pre-release.** The GitHub release is marked pre-release and carries `Formamorph-android.apk` and `Formamorph-android.apk.sha512`. In the Actions run, `itch-web` and `itch-desktop` show as skipped. That is the pre-release half of the last checklist line.

### On the phone, first install

4. Open the pre-release page in the phone browser and download the APK. Android asks to allow the browser, then installs. → **First install**, **Play Protect** (compare the wording with the wiki page [Install-on-Android.md](docs/Install-on-Android.md)).
5. Footer reads `v2.17.0-beta.1 · android`. Enter a bundled world. One turn against the cloud endpoint. Then set the endpoint to the PC's LAN address over plain `http://` and take one more turn. → **Main menu, bundled world, cloud, LAN**.
6. Airplane mode on. Open the World Editor, edit, save; load a save. Tap the version line and use Check for updates. → **Airplane mode**. Airplane mode off.
7. Tap the version line and set **Release channel** to **Pre-release**.

### Second pre-release, and the update path

8. Set `version` to `2.17.0-beta.2`, commit, tag `v2.17.0-beta.2`, push the tag. The version code drops the suffix, so both betas share one code. This is the same reinstall path the stable `2.17.0` will take over a beta, so a success here also proves that path.
9. **Tamper the sidecar** on the beta.2 release: on the GitHub release page, delete `Formamorph-android.apk.sha512` and upload a file with the same name holding a wrong 128-hex digest. Keep the correct digest; the `android` artifact on the Actions run has it.
10. Phone: the footer shows **Update Available** once the checker runs, or use Check for updates. → **Footer, beta channel**.
11. **Version Requirement**, while beta.2 is still uninstalled so Update has a release to fetch. From the PC, with a staff token:

   ```bash
   curl -X PUT https://api.formamorph.ai/api/settings/client_minimums -H "Authorization: Bearer $STAFF_TOKEN" -H 'Content-Type: application/json' -d '{"value":{"POST /api/reports":{"minVersion":"9.0.0","feature":"Reporting"}}}'
   ```

   Phone: browse Community Creations, open a listing, like it. All of that works. File a report: the Update Dialog names **Reporting**. Tap Update: the download starts. It fails on the tampered checksum, which is the next line. Then reset the gate:

   ```bash
   curl -X PUT https://api.formamorph.ai/api/settings/client_minimums -H "Authorization: Bearer $STAFF_TOKEN" -H 'Content-Type: application/json' -d '{"value":{}}'
   ```

12. Tap Download against the tampered sidecar. → **Tampered sidecar**: the footer shows the checksum error, and a second Download starts from zero rather than offering Install.
13. Restore the correct sidecar on the release. Download again. Progress shows under the version line. Force-stop the app from Android settings mid-way or after it finishes, reopen it. → **Download progress, restart offers Install**.
14. Tap Install. Android opens the install-unknown-apps setting for Formamorph. Turn it on, return. Tap Install again: the system install sheet opens. → **First apply, second apply**.
15. After the install, open the app. Footer reads `v2.17.0-beta.2 · android`. Saves, worlds, settings, and the LAN endpoint are still there. → **Relaunch**.

### Remaining lines

16. Export a world, a save, and a character card. Each opens the share sheet; save each to Files and reopen it there. Also try the VRM picker once: `accept=".vrm,.glb"` may offer nothing selectable in the system picker (ticket 06 comment). → **Share sheet**.
17. Back with a dialog open closes the dialog. Back in a game asks before leaving. Back on the main menu asks before exit. → **Back**.
18. The stable half of the last line is ticked on the first stable tag: `itch-desktop` runs only on a tag ending in `.0`, so `v2.17.0` updates the itch android channel and a patch tag does not.

### After the run

- Set `version` to whatever the release plan says. The two beta tags stay; the release checker orders `2.17.0` above both.
- Delete the two pre-releases only if their APKs should stop being offered on the Pre-release channel.
