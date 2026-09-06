# 02 — Landing header sign-in control

Status: ready-for-human
Status note: Implemented; review stage. The landing control links to a profile and has no sign-out action. Site account navigation/sign-out is ticket 09.
Spec: ../spec.md

**What to build:** The landing page header shows "Sign In" with a person icon at top right. A signed-in player sees their avatar instead, linking to their profile.

**Blocked by:** 01.

- [x] The static landing page reads the shared session keys through tracked `hosting/session.js`. No React on the landing page; key/API parity is guarded by tests rather than a shared import.
- [x] Signed out: Sign In plus person icon, linking to `/login?next=/`. Signed in: avatar only, linking to `/u/<username>`. Falls back to the person icon when no avatar is set.
- [x] Follows the `storage` event, so a sign-in in another tab updates the header.
- [x] Playwright on the static site server: both states, both viewports.

## Comments

**Where the module lives, and how "shared" it really is.**

`hosting/session.js` is a tracked plain file, not something the site entry's build emits. It has to be:
the landing page is served straight out of `hosting/` — live by the deploy's `cp -r hosting/. out/`, and
locally by `scripts/serveSite.mjs`, which serves that directory alone. A file emitted into `site-dist/`
would exist at neither. So the site entry does not literally ship it, and nothing under `site/` imports
it, because no account page needs it yet. It is a second hand-written statement of the keys, kept honest
by tests rather than by an import:

- `TOKEN_KEY` / `USER_KEY` are asserted equal to `AuthService.tokenKey` / `userKey`.
- `API_ORIGIN` is asserted equal to `VITE_API_URL_PROD`, and `avatarSrc` to `serverAssetSrc` handed the
  same base. Move the API and this fails rather than serving 404 avatars.

A rename on either side breaks the gate. What no test can catch is a *third* key: if AuthService ever
adds one the session depends on, the landing page will not know. Worth a line here rather than a silent
assumption.

**Deliberate, out of the checklist — recorded so none of it reads as an oversight.**

- **Two live-site probes were added for `/session.js`** (status and a `*javascript*` content type). No
  checkbox asked for them. The landing page now hard-depends on that file, and a 404 or a type the
  browser refuses to run as a module leaves the header on Sign In while `/` still answers 200 — nothing
  else in the battery would notice.
- **A broken avatar URL falls back to the person icon**, not only a missing one. The checklist covers
  "no avatar set"; a dead URL would otherwise leave a torn-page glyph in the header.
- **`readSession` reports signed out when the held user has no username.** AuthService can hold a token
  with a nameless user for a moment during sign-in. There is no profile to link to in that window, so
  the header shows Sign In rather than pointing at `/u/undefined`.
- **The changelog reorder is rule-driven, not churn.** The changelog's own rules put groups first in
  their bucket and fold a follow-up into an entry from the same unreleased batch, so the new
  **Website Accounts** group moved above a loose entry and ticket 01's deploy line gained the probe.
- **`--edge` and `--lift` were added to the landing page's `:root`.** The account pill wanted the exact
  border and hover fill `.btn-ghost` already used as literals. Both now read the tokens.

**Guards worth knowing about.**

- `site/session.test.ts` is the only thing type-checking the module's shape — it carries `// @ts-check`,
  and it enters the TypeScript program through that test's import, not through `tsconfig.json`.
- The cross-tab spec drives two real pages in the test's own context, so the phone project runs it at
  phone size. A `browser.newContext()` there would silently re-run the desktop viewport.
