# 04 — Public profile and not-found

Status: ready-for-agent
Spec: ../spec.md

**What to build:** A creator shares `formamorph.ai/u/<username>`. Visitors see the avatar, username, stats, and creations the in-app profile shows, after the age attestation. `/profile` sends a signed-in player to their own page.

**Blocked by:** 01.

- [ ] `/u/<username>` mirrors the in-app profile dialog's content using the same community services. Creation cards are display only.
- [ ] `/profile` redirects to the own profile, or to `/login?next=/profile` when signed out.
- [ ] Unknown and suspended usernames render one plain not-found page.
- [ ] The age gate reads and writes the app's localStorage flag at the same version, with the same copy, before the profile renders. Decline returns to `/`.
- [ ] jsdom tests: gate before render, one answer skips the gate, not-found for unknown and suspended, redirect when signed out.
