# 02 — Client identity header and the Update Dialog

Status: ready-for-human
Type: task
Spec: ../spec.md (Implementation Decisions › The Version Requirement; Testing Decisions)

Platform-independent. Ships with the next desktop release regardless of the APK.

## Task

- Add a global `fetch` wrapper of the same shape as the privacy-refusal watcher. Installed once at app start with the API base URL. On requests to that base it adds `X-Formamorph-Client: <version> <platform>`. Platform is one of `web`, `windows`, `linux`, `mac`, `android`, derived from the build class and the desktop bridge. On replies from that base with status 426 and body code `CLIENT_UPDATE_REQUIRED` it calls back with `{ feature, minVersion }`. The response is returned untouched; the body is read from a clone.
- Add the Update Dialog. It shows the feature name, the version required, the running version, and an Update button. Update runs the platform update flow through the bridge accessor from ticket 05 when a bridge exists, else reloads the page. De-duplicate on feature name until dismissed.
- Mount the dialog once at app level next to the Privacy Policy prompt.
- Add one sentence to the privacy policy text about the header (server row and public page; see the abuse-signals effort for where each lives).
- Changelog In-Progress entry, 👤 bucket.

## Acceptance

- Unit tests per the spec's Testing Decisions for the wrapper and the dialog.
- Four gates green.

## Comments

Done, 2026-09-04. The header wrapper is `src/lib/clientIdentity.ts` (with `urlOf` shared out of the
privacy-refusal watcher into `src/lib/fetchTarget.ts`); the dialog and its gate are
`src/components/modals/UpdateRequiredDialog.tsx`, mounted in `App.tsx` **before** `AppViews` so the
header is on `fetch` before any screen's mount effect sends a request. `#dev?modal=updateRequired`
raises it on a canned refusal.

Two calls worth knowing:

- **Update hands off, it does not drive.** The dialog asks `UpdateService.checkForUpdate(channel)` for
  the release, starts `bridge.download({ version, channel })`, and says the update has started. It does
  not show progress and does not apply: the main menu's version line already owns both, and ticket 05's
  hook owns the flow. The channel matters — the desktop bridge's own default release is the newest of
  *either* channel, so a stable player could otherwise be handed a prerelease.
- **The bridge accessor is deliberately one method.** `src/lib/updates/updateBridge.ts` exposes only
  `download`, because that is all any surface reaches for through it today. Ticket 05 widens it with the
  Android adapter and whatever its hook needs.

Left for the maintainer: **the live privacy policy row still has the old body.** The seed step inserts
only when the row is absent, so editing `src/assets/policies/privacy-policy.md` in the server repo
changes fresh databases only. Paste the new **Your app version** paragraph into the row from Admin
Panel → Policies before the cutover.
