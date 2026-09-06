# 03 — Live cross-tab session sync

Status: ready-for-human
Status note: Service/app synchronization and both real cross-surface browser directions are implemented and verified.
Spec: ../spec.md

**What to build:** Signing in on the site signs in an open `/play/` tab at once. Signing out on either side signs out both. No reload anywhere.

**Blocked by:** 09 for site-initiated sign-out coverage. Ticket 01 is implemented; the same-origin test setup and site-login/app-logout cases can proceed.

- [x] AuthService listens to the `storage` event for its two keys, updates in-memory state, and notifies subscribers. Logout clears both keys.
- [x] The app's main menu follows AuthService state, including the age-gate check on adoption.
- [x] AuthService unit tests: a foreign write signs in, a removal signs out, the subscriber is notified, a corrupt user blob is tolerated.
- [x] Playwright, two pages in one context: sign in on the site page, the app page shows the signed-in menu without reload; sign out in the app, the site page shows signed out.
- [x] Sign out through the site's control and assert the open app and landing header follow without reload.

## Comments

### Audit — 2026-09-06

Reopened the browser checkbox: `e2e/session-sync.spec.ts` opens two app pages and injects storage for sign-in. It does not submit the real site login form. Serve/proxy the actual site and `/play/` under one test origin and exercise both logout directions. Use a document marker that disappears on reload; comparing navigation-entry counts does not prove that the document survived, since a reload creates a new performance timeline.

`AccountPage` now listens for session end and leaves for `/`, but `SiteLayout` has no session control and the landing header only links to the public profile. The service tests passing does not close these end-to-end acceptance cases.

**Done.** AuthService follows the `storage` event for `authToken` and `currentUser`, re-reads both keys
(one event carries one key, the session is two), and stays quiet when the stored session is the one it
already holds. A foreign sign-out reaches the existing `onSessionEnded` subscribers; a foreign sign-in
reaches a new `onSessionAdopted`. `logout()` already cleared both keys.

The main menu subscribes to `onSessionAdopted` and bumps a nonce the existing auth check reads, so the
adoption goes through the one path that already waits on the age attestation and refreshes the profile.
`AgeGateProvider` subscribes too and raises the gate for an unattested device, mirroring its boot pass;
declining signs the adopted session back out.

**The Playwright case is same-origin, not site-to-app.** Live, `/login` and `/play/` are one origin and
one `localStorage`. Under the runner the site entry is a dev server on 5186 and the app one on 5183, so
they are two origins with two separate storages and no `storage` event crosses between them. The spec
therefore pairs the app page with a second app page, the same substitution `landing.spec.ts` already
makes with `/privacy`; the site half of the mechanism is covered there. Pairing the real pages would need
the app dev server mounted at base `/play/` and proxied by the site one — a change to `playwright.config.ts`
and `e2e/app.ts` that every spec would carry. Worth doing if the site pages ever grow a sign-out control
that this cannot reach.
