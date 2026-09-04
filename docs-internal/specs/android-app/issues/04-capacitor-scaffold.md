# 04 — Capacitor scaffold

Status: ready-for-agent
Type: task
Spec: ../spec.md (Implementation Decisions › The Android App)

## Task

- Add Capacitor core and android at the live latest versions (check `npm view`). App id `ai.formamorph.app`, app name `Formamorph`, web dir `dist`.
- Commit the generated `android/` project. Set the icon and splash from the existing icon assets.
- Network security config: cleartext permitted to localhost and RFC 1918 ranges only.
- Manifest: add the install-packages permission. Nothing else beyond defaults.
- Build class `android` for the footer. Add npm scripts in the `desktop:*` style: `android:sync`, `android:open`, `android:run`.
- Confirm the desktop check stays false in the WebView so the local engine and catalog stay hidden.
- Install Android Studio on the dev machine and run the app on the real phone once. Note the SDK path in a memory file.
- Changelog In-Progress entry, 🛠️ bucket.

## Acceptance

- `npx cap run android` installs and opens the app on the phone. Main menu, a bundled world, and one AI turn against the cloud endpoint work.
- A LAN LM Studio endpoint over http works from the phone.
- Four gates green.
