# 09 — Site account navigation and sign-out

Status: needs-triage
Status note: Missing behavior confirmed in the client; choose the control placement before implementation.
Spec: [Website accounts](../spec.md), stories 4, 10, 11, and 19.

**Dependencies:** Tickets 01, 02, and 05 are implemented. Coordinate browser coverage with ticket 03.

## What is missing

The landing avatar links to `/u/<username>`. That page has no link to `/account`; the shared site header contains only the home link. None of these surfaces offers sign-out. `/account` is reachable by a typed URL or verification-result link, but not through the normal profile flow.

`LoginPage` also ignores the `deletionCancelled` result that the app surfaces. Ticket 01 deferred its notice to ticket 05, which did not implement it.

## Decision needed

Choose where account settings and sign-out live on the site. Preserve the specified one-click landing-avatar link to the public profile. Recommend controls in the shared site header, including a settings link on the own-profile path. Choose how the deletion-cancellation notice survives the post-login return to `next`.

## Done when

- [ ] A signed-in visitor can reach account settings from the landing/profile flow.
- [ ] A site control signs out through the shared session, updates the local UI, and signs out open app/landing tabs.
- [ ] The site session control follows foreign sign-in/sign-out and avatar updates.
- [ ] A login that cancels pending deletion tells the player and preserves the safe return path.
- [ ] Browser tests cover the actual controls at desktop and phone sizes; ticket 03 covers both cross-surface logout directions.
- [ ] Four gates and live UI verification pass; no world/save export change.
