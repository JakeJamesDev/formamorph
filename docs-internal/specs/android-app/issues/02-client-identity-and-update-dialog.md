# 02 — Client identity header and the Update Dialog

Status: ready-for-agent
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
