# 03 — Live cross-tab session sync

Status: ready-for-human
Spec: ../spec.md

**What to build:** Signing in on the site signs in an open `/play/` tab at once. Signing out on either side signs out both. No reload anywhere.

**Blocked by:** 01.

- [x] AuthService listens to the `storage` event for its two keys, updates in-memory state, and notifies subscribers. Logout clears both keys.
- [x] The app's main menu follows AuthService state, including the age-gate check on adoption.
- [x] AuthService unit tests: a foreign write signs in, a removal signs out, the subscriber is notified, a corrupt user blob is tolerated.
- [x] Playwright, two pages in one context: sign in on the site page, the app page shows the signed-in menu without reload; sign out in the app, the site page shows signed out.

## Comments

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
