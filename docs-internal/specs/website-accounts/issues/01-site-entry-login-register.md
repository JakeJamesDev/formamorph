# 01 — Site entry with login and register

Status: ready-for-human
Status note: Implemented; review stage. Privacy acceptance is ticket 08; theme scope is ticket 10. Current route coverage is recorded below.
Spec: ../spec.md

**What to build:** A visitor opens `formamorph.ai/login`, signs in, and lands back where they came from. `/register` creates an account the same way. The pages look like the landing page and ship through both deploy paths.

**Blocked by:** None — can start immediately.

- [x] Second Vite entry with an absolute base, React, reusing AuthService and the shadcn primitives restyled to the landing-page look. The game bundle never loads on a site page.
- [x] `/login` and `/register` with username and password. The email field arrives in ticket 06. Errors show inline.
- [x] `?next=` accepted only as a same-origin absolute path, default `/`.
- [x] Hosting redirects serve the entry for `/login`, `/register`, `/account`, `/profile`, `/u/*`, `/reset-password`, `/verify-email`.
- [x] The entry builds to its own ignored output. The deploy action layers the hosting dir, the site build, and `/play/`. `site_only` builds the site entry and still skips the app build.
- [x] Live check probes one site route for HTML.
- [x] jsdom tests: sign-in success stores the shared keys; the `?next=` filter; error rendering. Playwright: login page renders at both viewports.
- [x] Four gates green; no export-shape change.

## Comments

### Audit — 2026-09-06

`site/App.tsx` now serves `/account`, `/profile`, `/u/<username>`, and `/verify-email` as well as login/register. Only `/reset-password` remains unimplemented among the specified routes (ticket 07). The five-placeholder note below describes the original delivery, not the current tree. The deploy action builds `site-dist` and layers it at `/site-app/` on both deploy paths; deployment itself has not been verified in this audit.

Login still discards `deletionCancelled`; the follow-up belongs to [ticket 09](09-site-account-controls.md). Ticket 10 retained and implemented coordinated light/dark styling for the landing and account pages.

**Deferred, deliberately — recorded so none of these reads as an oversight.**

- **The register page skips the Privacy Policy step the game's register modal runs.** Out of this
  ticket's checklist, and the app's `PolicyDialog` renders the policy through `MarkdownRenderer`, which
  pulls Streamdown and Shiki — megabytes with no business in a login page. An account made on the site
  works but is refused by the server (`PRIVACY_REQUIRED`) until its owner opens `/play/` and accepts
  there. Written up as ticket 08.
- **Theme work was deferred from this ticket.** Ticket 10 later added the coordinated landing/account
  palettes and the read-only resolver that follows the app's choice.
- **Five of the seven rewritten routes serve a 200 "Page Not Found" until their tickets land** —
  `/account`, `/profile`, `/reset-password`, `/verify-email` and `/u/*`. The checklist asks for all seven
  rules now, so this is the specified state, not a bug.
- **A sign-in on the site that cancels a pending account deletion says nothing.** `AuthService.login`
  reports it and the game's modal surfaces it; the site page has no notice surface and leaves at once.
  Worth a line on the account page in ticket 05.

**Guards worth knowing about.**

- `site/bundleBoundary.test.ts` is what keeps "the game bundle never loads on a site page" true. It reads
  every `@/…` import under `site/` against a short allow list. Adding a game import turns it red; the
  build alone would stay green and simply grow by megabytes.
- The Playwright palette guard reads `--bg` and `--accent` off the real landing page on 5185 and compares
  them to the rendered ground and button fill on 5186, rather than against copied hex.
