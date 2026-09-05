# 06 — Email everywhere

Status: ready-for-agent
Spec: ../spec.md

**What to build:** A player adds an optional email when registering on the site or in the app. On `/account` they set or replace it, see whether it is verified, and resend the mail. The link in the mail lands on `/verify-email` and confirms the address.

**Blocked by:** 05; server ticket 02.

- [ ] Optional email field on the site register page and the app's register modal, with the taken-email error shown.
- [ ] Email section on `/account`: current address, verified state, set or replace, resend.
- [ ] `/verify-email` consumes the token and shows success, or an expired-link message with a resend path.
- [ ] jsdom tests for both forms and the account section; a test for the verify page in both outcomes.
