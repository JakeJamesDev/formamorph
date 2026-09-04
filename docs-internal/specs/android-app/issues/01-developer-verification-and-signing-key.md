# 01 — Developer verification and the signing key

Status: ready-for-human
Type: task
Spec: ../spec.md (Ordering constraint; Implementation Decisions › Build and release; Further Notes)

Maintainer work. Nothing in code depends on it, but no public APK ships before both parts are done.

## Task

- Register a verified developer identity through the Google Play Console. Record the package name `ai.formamorph.app` there once the console asks for it.
- Run the wizard: `bash scripts/android-signing-wizard.sh` from the repo root in Git Bash. It walks the console signup, generates the PKCS12 keystore outside the repo, prints the fingerprint, waits for the password-manager backup, and sets the four repository secrets through `gh`.
- Secret names, fixed here and consumed by ticket 08: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. The keystore is PKCS12, so the two passwords are the same value.
- Re-run the wizard after the first CI release build to register the app with Google (stage 5 needs a signed APK).

## Acceptance

- The verification status in the console reads verified.
- The keystore and its passwords exist in the password manager.
- The four secrets exist on the repository.

## Comments

**2026-09-04.** Wizard run to stage 4. Keystore at `C:/Users/benny/formamorph-android-signing/formamorph-release.p12` (Git Bash shows it as `/home/benny/...`), backed up in LastPass as base64 in a Secure Note. The wizard skipped the secrets because the shell's `gh` was logged in as a different account than the repo owner; the four secrets were then set by hand and the user reports them present (agent could not list them: session token lacks the secrets scope). Still open: Play Console verification outcome, and stage 5 (app registration) after the first signed APK. Open question from the same day: whether to switch to the Android Developer Console so the legal name is not shown on Google Play.
