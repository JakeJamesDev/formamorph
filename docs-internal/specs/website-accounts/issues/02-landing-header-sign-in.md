# 02 — Landing header sign-in control

Status: ready-for-agent
Spec: ../spec.md

**What to build:** The landing page header shows "Sign In" with a person icon at top right. A signed-in player sees their avatar instead, linking to their profile.

**Blocked by:** 01.

- [ ] The static landing page reads the shared session keys through the small vanilla module the site entry ships. No React on the landing page.
- [ ] Signed out: Sign In plus person icon, linking to `/login?next=/`. Signed in: avatar only, linking to `/u/<username>`. Falls back to the person icon when no avatar is set.
- [ ] Follows the `storage` event, so a sign-in in another tab updates the header.
- [ ] Playwright on the static site server: both states, both viewports.
