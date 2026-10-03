# 10: Patreon Section in the App

Status: ready-for-human
Status note: Built in 57657350. Open: the `verify-ui` criterion (the preview needs a real session) and a device check that `window.open` reaches the system browser on Android (UNVERIFIED; Electron routes it through `setWindowOpenHandler`).
Base: b6c69c76
Blocked by: 01, 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Ruling Q11; A3; Implementation Decisions › Account settings)

Model rationale: reuse of the shared section, plus the browser hand-off on three shells (web, desktop, Android).

## What to build

A signed-in member opens the User Profile dialog, goes to the **Settings** tab, and links Patreon from there. The link flow opens in the system browser. When the member returns to the app, the section shows the new status.

## Acceptance criteria

- [ ] The Settings tab shows the shared Patreon section from ticket 09 with the same three states.
- [ ] **Link Patreon** opens Patreon's approval page outside the app: a new tab on the web, the system browser on desktop and Android.
- [ ] The section reads the status again when the app window gets focus or becomes visible. It needs no restart.
- [ ] After the callback, the site's account page asks the member to sign in if needed, confirms the link, and tells the member to return to the app.
- [ ] The toggle and Unlink work as on the site.
- [ ] The dev-router entry for the Settings tab shows the section.
- [ ] Tests cover the open-outside call and the status read on focus. Every async write checks the mounted ref.
- [ ] `verify-ui` evidence of the section in the tab, in both themes.
- [ ] A changelog line in In Progress, folded into the entry of ticket 09 while it is unreleased.
- [ ] Four gates green.
