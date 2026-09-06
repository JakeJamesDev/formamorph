# 04 — Public profile and not-found

Status: ready-for-human
Status note: Client and server ticket 05 are implemented; real deployed-profile verification remains open.
Spec: ../spec.md

**What to build:** A creator shares `formamorph.ai/u/<username>`. Visitors see the avatar, username, stats, and creations the in-app profile shows, after the age attestation. `/profile` sends a signed-in player to their own page.

**Dependencies:** Client 01 and [server 05](../../../../../FormamorphServer/docs-internal/specs/website-accounts/issues/05-public-profile-by-username.md) are implemented. Deployment verification remains open.

- [x] `/u/<username>` mirrors the in-app profile dialog's content using the same community services. Creation cards are display only.
- [x] `/profile` redirects to the own profile, or to `/login?next=/profile` when signed out.
- [x] Unknown and suspended usernames render one plain not-found page.
- [x] The age gate reads and writes the app's localStorage flag at the same version, with the same copy, before the profile renders. Decline returns to `/`.
- [x] jsdom tests: gate before render, one answer skips the gate, not-found for unknown and suspended, redirect when signed out.

## Comments

### Audit — 2026-09-06

The client calls `GET /api/users/by-username/:username/profile` through `UserService.fetchProfileByUsername`. Server commit `36bd871` implements that route; the old endpoint-missing blocker is resolved. Verify a real found profile before closing integration. Server 05 records exact-case precedence and oldest visible match for ambiguous folded names, plus an outstanding disclosure gap through the existing ID endpoint. Review those notes; the mocked client 404 cannot establish the full suspension contract. The original comments below record the implementation session's evidence only.

**The client is done; the endpoint it calls is not.** Every profile call the server has takes a UUID —
`GET /api/users/:id/profile` reads `User.findById`, so a username misses and 404s — and the profile DTO
carries no `status`, so a client cannot tell a suspended account from an ordinary one. Two of the boxes
above are unsatisfiable client-side. The server ticket
`FormamorphServer/.../issues/05-public-profile-by-username.md` adds one public
`GET /api/users/by-username/:username/profile`, case-insensitive, 404 for unknown **and** for suspended,
returning the DTO `getUserProfile` already builds. The existing `/:id/profile` is untouched, so the
in-app dialog does not change. **This page is correct but blank until that ships**; a live 404 renders
the not-found page, which is what the site does today.

**What the page reuses, and the boundary that made it awkward.** The ticket says "the same community
services", so the page calls `UserService` and draws with `ProfileStats`, `UserCreationsTab`,
`UserAvatar` and `RoleBadge` rather than a second set of components. `bundleBoundary.test.ts` refused
that at first, and rightly: `UserAvatar` and `UserCreationsTab` each reached into
`WorldStorageService` for one string — the API origin — which would have dragged the world store, the
migrations and the placeholder engine into a login page. `src/lib/apiBase.ts` now holds that string, the
three services read it, and the two components take it from there. The guard grew a second test that
follows every allowed leaf one hop deeper, so the next component to reach for a manager fails the same
way rather than quietly costing megabytes. Proven by re-pointing `UserAvatar` at `WorldStorageService`:
the guard fails and names the route in.

**Deliberately not built.** The in-app dialog's Follow and Report controls. Both need a session and a
place to put a refusal, and a shared link is a thing to read. The ticket asks for the dialog's
*content*, which is the picture, the name, the stats and the listings, and those are all here. Say so if
Follow is wanted on the site; it is a small addition once there is somewhere for an error to go.

**Not verified live:** the profile as the real server will answer it. The endpoint does not exist yet, so
the found state was checked against a throwaway mock at both viewports; the gate, the not-found page and
the `/profile` redirect were checked against the real dev server.

**What the review changed.** A two-axis review found nine things; six are fixed here. The tab was titled
from the address bar before the fetch answered, so a name nobody has appeared above a page saying the
account is not there — the page now titles itself from the answer. The site entry had no
`TooltipProvider`, so every tip on a profile ran at Base UI's default rather than the app's shared beat.
`UserCreationsTab` wore dialog geometry on a page: a fixed 15.5rem scroller and an 11px pad that exists
to offset *the dialog's* scrollbar gutter, which left the column off-center. It now takes a `layout`
prop, defaulting to the dialog it was built for. The catch clause annotated its rejection `Error`, which
would have rendered `undefined` in the alert. `fetchProfile` hand-rolled the unwrap its neighbor uses.
Six test files kept a mock of a service their subjects no longer import.

Two findings are answered rather than fixed. The `apiBase` extraction touching three services reads as
scope creep from the ticket, and it is wider than the two components that forced it — but a module that
exists while its own owners still hand-roll the value is two names for one thing, so all three read it.
**Named, not fixed:** ten-plus call sites still reach the base URL through `WorldStorageService.API_URL`;
finishing that migration is its own pass. And `CachedThumbnail` opens `FORMAMORPH_THUMBS_DB` on a
profile view — kept, because the site and `/play/` are one origin and that is the same cache the game
fills, so a visitor who later opens the game has the thumbnails already.

The suspended case cannot be tested harder on this side: the client sees one 404 and no status field, so
the test proves what it can — two different names, the same refusal, byte-identical output. The guard
that suspension stays indistinguishable belongs to server ticket 05, which asserts it.
