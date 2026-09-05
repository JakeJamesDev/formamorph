# 03 — Live cross-tab session sync

Status: ready-for-agent
Spec: ../spec.md

**What to build:** Signing in on the site signs in an open `/play/` tab at once. Signing out on either side signs out both. No reload anywhere.

**Blocked by:** 01.

- [ ] AuthService listens to the `storage` event for its two keys, updates in-memory state, and notifies subscribers. Logout clears both keys.
- [ ] The app's main menu follows AuthService state, including the age-gate check on adoption.
- [ ] AuthService unit tests: a foreign write signs in, a removal signs out, the subscriber is notified, a corrupt user blob is tolerated.
- [ ] Playwright, two pages in one context: sign in on the site page, the app page shows the signed-in menu without reload; sign out in the app, the site page shows signed out.
