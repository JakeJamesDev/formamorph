# 07 — Password reset pages and Forgot links

Status: ready-for-agent
Status note: Not implemented in the current client tree. Server ticket 03 is implemented; client work can start. Production deployment remains unverified.
Spec: ../spec.md

**What to build:** A player who forgot a password clicks Forgot password on `/login` or in the app's login modal, requests a reset, opens the mailed link, and sets a new password. Desktop and Android open the page in the system browser.

**Dependencies:** Client 01 and [server 03](../../../../../FormamorphServer/docs-internal/specs/website-accounts/issues/03-password-reset-by-email.md) are implemented; no implementation blocker remains.

- [ ] `/reset-password` without a token: a request form taking email or username, always showing the same confirmation.
- [ ] `/reset-password?token=`: a new-password form, then a sign-in prompt on success, or an expired-link message.
- [ ] Forgot password link on `/login`. The same link in the app's login modal, opened through the existing external-link path on desktop and Android.
- [ ] jsdom tests: the request form response is identical for any input; the token form in both outcomes; the app modal link present and external.

## Comments

### Audit — 2026-09-06

`site/App.tsx` has no reset route, `AuthService` has no reset request/complete methods, and neither login UI offers Forgot password. The hosting rewrite already exists. Keep one-hour expiry, single use, verified-email-only delivery, and session invalidation owned by the server ticket; confirm those through integration rather than reimplementing them in the client. Distinguish transport failure from a successfully accepted generic request, and protect token consumption against duplicate submission.

Server contract checked in `src/routes/auth.js` and `authController.js` at commit `bca6cc3`:

- `POST /api/auth/request-password-reset` with `{ account }` (email or username) returns `{ success: true }` for an accepted request.
- `POST /api/auth/reset-password` with `{ token, newPassword }` returns success without a replacement session; invalid/spent links return HTTP 400 with `code: TOKEN_INVALID`.
- Empty requests, invalid passwords, and rate limits have separate refusal paths; do not present those as successful submission.
