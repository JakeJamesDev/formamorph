# 05 — Account page: password, avatar, delete

Status: ready-for-agent
Spec: ../spec.md

**What to build:** A signed-in player opens `/account`, changes their password, uploads a new avatar, or deletes the account with password confirmation. Signed-out visitors are sent to sign in and come back.

**Blocked by:** 01.

- [ ] `/account` requires a session; otherwise it redirects to `/login?next=/account`.
- [ ] Change password, avatar upload, and delete account use the existing AuthService calls and match the app's rules and copy.
- [ ] Deletion signs out both surfaces through the shared keys.
- [ ] An avatar change updates the shared user record so the header and the app pick it up.
- [ ] jsdom tests: redirect when signed out; each action calls its endpoint and reflects the result.
