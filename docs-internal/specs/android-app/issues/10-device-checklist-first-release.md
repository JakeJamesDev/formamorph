# 10 — Device checklist before the first public APK

Status: ready-for-human
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
