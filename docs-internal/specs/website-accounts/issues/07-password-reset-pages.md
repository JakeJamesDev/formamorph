# 07 — Password reset pages and Forgot links

Status: ready-for-human
Status note: Client flow implemented and verified locally. Production deployment and real mail delivery remain unverified.
Spec: ../spec.md

**What to build:** A player who forgot a password clicks Forgot password on `/login` or in the app's login modal, requests a reset, opens the mailed link, and sets a new password. Desktop and Android open the page in the system browser.

**Dependencies:** Client 01 and [server 03](../../../../../FormamorphServer/docs-internal/specs/website-accounts/issues/03-password-reset-by-email.md) are implemented; no implementation blocker remains.

- [x] `/reset-password` without a token: a request form taking email or username, always showing the same confirmation.
- [x] `/reset-password?token=`: a new-password form, then a sign-in prompt on success, or an expired-link message.
- [x] Forgot password link on `/login`. The same link in the app's login modal, opened through the existing external-link path on desktop and Android.
- [x] jsdom tests: the request form response is identical for any input; the token form in both outcomes; the app modal link present and external.

## Comments

### Audit — 2026-09-06

`site/App.tsx` has no reset route, `AuthService` has no reset request/complete methods, and neither login UI offers Forgot password. The hosting rewrite already exists. Keep one-hour expiry, single use, verified-email-only delivery, and session invalidation owned by the server ticket; confirm those through integration rather than reimplementing them in the client. Distinguish transport failure from a successfully accepted generic request, and protect token consumption against duplicate submission.

Server contract checked in `src/routes/auth.js` and `authController.js` at commit `bca6cc3`:

- `POST /api/auth/request-password-reset` with `{ account }` (email or username) returns `{ success: true }` for an accepted request.
- `POST /api/auth/reset-password` with `{ token, newPassword }` returns success without a replacement session; invalid/spent links return HTTP 400 with `code: TOKEN_INVALID`.
- Empty requests, invalid passwords, and rate limits have separate refusal paths; do not present those as successful submission.

### Implementation — 2026-09-06

`ResetPasswordPage` owns both URL modes. The request form ignores the server&rsquo;s response body after an
accepted request and renders one fixed confirmation; empty input, rate limits, and transport failures stay
distinct. The token form treats only `TOKEN_INVALID` as a spent link. Other refusals and a server that never
answered remain on the form, so the reader can correct the password or retry. Its busy state disables the
submit control while the one-use token is in flight.

The website&rsquo;s `/login` uses an internal `/reset-password` link. The app uses the existing external-link
shape: an absolute HTTPS anchor with `_blank` and `noopener noreferrer`, which the desktop shell and Android
WebView hand to the system browser. `#dev?modal=auth` now reaches that dialog directly for static checks.

The jsdom coverage drives the rendered pages through the real `AuthService` fetch boundary. It covers two
account spellings with byte-for-byte identical confirmation, accepted-request versus refusal, successful and
spent tokens, transport failure, duplicate activation, the site route, both Forgot links, and the app
link&rsquo;s external attributes. The privacy copy, spent-token branch, duplicate lock, and external target were
each mutation-tested by removing the guard and watching the expected test fail.

Targeted coverage measured across 97 passing tests: `ResetPasswordPage.tsx` 100% lines / 92%
branches / 100% functions; `LoginPage.tsx` 100% / 88.88% / 100%; `site/App.tsx` 88.46% /
42.85% / 100%; `AuthService.ts` 81.60% / 73.88% / 85.18%; `AuthModals.tsx` 72.54% / 50.70% /
43.47%; and `devRoutes.ts` 100% across all three measures. The lower totals belong to the large shared
modules&rsquo; pre-existing branches; every password-reset branch is exercised directly.

Live checks at desktop and 375&times;812 covered both reset-page forms and the app login modal. The local check
does not prove production deployment or real email delivery; those remain human/live acceptance work.
