# 07 — Password reset pages and Forgot links

Status: ready-for-agent
Spec: ../spec.md

**What to build:** A player who forgot a password clicks Forgot password on `/login` or in the app's login modal, requests a reset, opens the mailed link, and sets a new password. Desktop and Android open the page in the system browser.

**Blocked by:** 01; server ticket 03.

- [ ] `/reset-password` without a token: a request form taking email or username, always showing the same confirmation.
- [ ] `/reset-password?token=`: a new-password form, then a sign-in prompt on success, or an expired-link message.
- [ ] Forgot password link on `/login`. The same link in the app's login modal, opened through the existing external-link path on desktop and Android.
- [ ] jsdom tests: the request form response is identical for any input; the token form in both outcomes; the app modal link present and external.
