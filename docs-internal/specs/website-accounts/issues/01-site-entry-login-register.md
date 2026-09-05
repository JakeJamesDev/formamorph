# 01 — Site entry with login and register

Status: ready-for-agent
Spec: ../spec.md

**What to build:** A visitor opens `formamorph.ai/login`, signs in, and lands back where they came from. `/register` creates an account the same way. The pages look like the landing page and ship through both deploy paths.

**Blocked by:** None — can start immediately.

- [ ] Second Vite entry with an absolute base, React, reusing AuthService and the shadcn primitives restyled to the landing-page look. The game bundle never loads on a site page.
- [ ] `/login` and `/register` with username and password. The email field arrives in ticket 06. Errors show inline.
- [ ] `?next=` accepted only as a same-origin absolute path, default `/`.
- [ ] Hosting redirects serve the entry for `/login`, `/register`, `/account`, `/profile`, `/u/*`, `/reset-password`, `/verify-email`.
- [ ] The entry builds to its own ignored output. The deploy action layers the hosting dir, the site build, and `/play/`. `site_only` builds the site entry and still skips the app build.
- [ ] Live check probes one site route for HTML.
- [ ] jsdom tests: sign-in success stores the shared keys; the `?next=` filter; error rendering. Playwright: login page renders at both viewports.
- [ ] Four gates green; no export-shape change.
