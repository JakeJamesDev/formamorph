# Spec: Website accounts — sign in from formamorph.ai, in sync with the app

Status: needs-triage
Status note: Client tickets 01–06 have implementations; cross-tab acceptance coverage, reset, privacy acceptance, site account controls, and theme scope remain open. See [the current inventory](inventory.md).
Server twin: `FormamorphServer/docs-internal/specs/website-accounts/spec.md`

## Problem Statement

This describes the starting problem. Current implementation and remaining work are tracked in [the inventory](inventory.md); historical ticket comments are not deployment evidence.

The only way to sign in is inside the game at `/play/`. The landing page at `formamorph.ai` knows nothing about accounts: no sign-in control, no profile a creator can share, no account settings outside the game menu. A player who forgets a password has no recovery path at all, because the server has never sent an email. Emails were never collected, so the column sits empty.

## Solution

Add account pages to the site: sign in, register, a public profile per user, an account settings page, and password reset by email. The site and the app share one session. Signing in or out on either side applies to the other at once, in every open tab. The landing page header shows a Sign In control, or the signed-in user's avatar.

On the server, email becomes a real field: unique, verifiable, and the channel for password reset. Registration on both the site and the app can take an optional email.

## User Stories

1. As a visitor, I want a Sign In control in the landing page header, so that I can reach my account without opening the game.
2. As a visitor, I want the Sign In control to show a person icon like most sites, so that I recognize it at once.
3. As a signed-in player, I want the header control to show my avatar instead of Sign In, so that I can see I am signed in.
4. As a signed-in player, I want the avatar to link to my profile, so that one click reaches it.
5. As a visitor, I want a `/login` page with username and password, so that I can sign in on the site.
6. As a visitor, I want a `/register` page with username, password, and optional email, so that I can create an account on the site.
7. As a player, I want login and register to return me to the page I came from, so that signing in does not lose my place.
8. As a player, I want the return path limited to this site, so that a crafted link cannot send me elsewhere after sign-in.
9. As a player, I want signing in on the site to sign me in at `/play/` too, so that I never sign in twice.
10. As a player, I want signing out on either side to sign out both, so that a shared computer holds no stale session.
11. As a player with two tabs open, I want the other tab to follow a sign-in or sign-out at once, so that tabs never disagree.
12. As a player, I want the app to keep working when it starts with a session the site created, so that the shared session is complete, not partial.
13. As a creator, I want a public profile at `/u/<username>`, so that I can share a link to my work.
14. As a visitor, I want a public profile to show the avatar, username, stats, and creations the in-app profile shows, so that the site and the app agree.
15. As a visitor, I want `/profile` to send me to my own public profile, so that I do not need to remember my username in a URL.
16. As a visitor, I want an unknown or suspended username to show one plain not-found page, so that suspension is not exposed.
17. As a visitor, I want the age attestation before a profile renders, so that community content stays behind the same gate as in the app.
18. As a player, I want one age answer to cover both the site and the app, so that I am not asked twice.
19. As a player, I want an `/account` page, so that account settings have a home outside the game menu.
20. As a player, I want to change my password on `/account`, so that I do not need the game to do it.
21. As a player, I want to set or replace my email on `/account`, so that I can enable password reset.
22. As a player, I want a verification email when I set an address, so that only an address I control counts.
23. As a player, I want `/account` to show whether my email is verified and offer to resend, so that I can finish verification later.
24. As a player, I want to upload or replace my avatar on `/account`, so that my profile and the app show the same picture.
25. As a player, I want to delete my account from `/account`, with password confirmation, so that the site matches the app's deletion path.
26. As a player, I want `/account` to require sign-in and send me to `/login` with a return path otherwise, so that the page never renders for a stranger.
27. As a player who forgot a password, I want a Forgot password link on `/login`, so that I can start recovery.
28. As a player in the app, I want a Forgot password link in the login modal, so that recovery is reachable from the game too.
29. As a desktop or Android player, I want that link to open the site in my system browser, so that recovery works outside the app shell.
30. As a player, I want to request a reset by email or username on `/reset-password`, so that I can recover without remembering both.
31. As a player, I want the reset request page to answer the same way whether the account exists, so that nobody can probe for accounts.
32. As a player, I want the reset email to hold a link that opens a new-password form, so that recovery is one click plus one form.
33. As a player, I want the reset link to expire after one hour and work once, so that an old email cannot be replayed.
34. As a player, I want a completed reset to sign out every other session, so that whoever had my old password is out.
35. As a player, I want a reset to go only to a verified email, so that an address someone else typed cannot take my account.
36. As a player registering in the app, I want an optional email field, so that I can enable recovery from the start.
37. As a player registering anywhere with an email, I want the account usable at once, so that verification never blocks play.
38. As a player, I want a clear error when an email is already taken, so that I know why registration failed.
39. As a player, I want the site pages to look like the landing page, so that the site feels like one place.
40. As a player, I want the site pages to work on a phone, so that a shared profile link is not desktop-only.
41. As a player, I want the pages to respect light and dark themes and reduced motion, so that the site matches the app's care.
42. As the maintainer, I want the site pages built by the release workflow and the `site_only` dispatch, so that a page change ships the same way the landing page does.
43. As the maintainer, I want the reset and verification endpoints rate-limited without storing an IP, so that abuse is bounded and the no-IP policy holds.
44. As the maintainer, I want mail sent through Resend from `noreply@formamorph.ai`, so that delivery is not our server's problem.
45. As the maintainer, I want the mail transport injectable, so that tests never send real mail.
46. As the maintainer, I want the email migration safe on the production database, so that the empty column gains its constraint without a data pass.

## Implementation Decisions

### Site pages

- **A second Vite entry** renders the site pages with React and reuses AuthService, the community services, and the shadcn primitives. The landing page stays the static file it is. The game bundle is never loaded on a site page.
- **Routes:** `/login`, `/register`, `/account`, `/profile` (redirects to own `/u/<username>`), `/u/<username>`, `/reset-password` (request form, and the new-password form when a token is in the URL), `/verify-email` (consumes a token). Routing is client-side under one entry; the hosting redirects gain the rules that serve that entry for these paths.
- **The site entry builds to its own ignored output directory**, never into the tracked hosting directory. The deploy action layers three things: the tracked hosting directory, the site entry's build, and the app build under `/play/`. The `site_only` dispatch builds the site entry; it still skips the app build.
- **The site entry uses an absolute base** so nested routes such as `/u/<username>` resolve assets. The app keeps its relative base.
- **Style:** the landing page's fonts, colors, header, and footer. Shadcn primitives are restyled to match; the in-game look is not used.
- **Landing header control:** signed out shows "Sign In" and a person icon, top right. Signed in shows the avatar alone, linking to the profile. The landing page reads the session with the same small vanilla module the site entry ships, so the static page needs no React.
- **Return path:** login and register accept `?next=`, accept only same-origin absolute paths, and default to `/`.
- **Public profile** mirrors the in-app profile dialog's content and the same community endpoints. Creation cards are display only. Unknown and suspended users render the same not-found page.
- **Age gate:** the site reads and writes the same localStorage flag as the app, with the same version, and shows the same copy before a profile renders.
- **`/account`** holds change password, change and verify email (with verified state and resend), avatar upload, and delete account. It requires a session and redirects to `/login?next=/account` without one.

### Shared session

- **Same storage keys.** The site and the app store the token and user under the keys AuthService already uses. Same origin, so both read one session.
- **Live cross-tab sync.** AuthService listens to the `storage` event for its two keys and updates its in-memory state and subscribers. The app's main menu and the site header both follow that state. Logout on either side clears both keys, so the other side's listener sees a sign-out.
- **Boot adoption.** The app already adopts a held token at boot behind the age-gate check; a site-created session goes through that same path unchanged.

### App changes

- The register modal gains an optional email field.
- The login modal gains a Forgot password link to `https://formamorph.ai/reset-password`. Desktop and Android open it in the system browser through their existing external-link paths.

### Server

- **Schema:** `email` gains a case-insensitive unique index; a nullable `email_verified_at` column is added. Both are safe on production because no rows hold an email.
- **Register** accepts an optional email, rejects a taken one with a distinct error, stores it unverified, and sends a verification mail. The account is usable at once.
- **Email endpoints under the authenticated user:** set or replace email (re-sends verification and clears the verified stamp), resend verification, and a public consume endpoint for the verification token.
- **Reset endpoints:** request by email or username, and complete with token plus new password. The request always answers success. Mail goes only when the account has a verified email. Completion bumps `token_version`, so all sessions end.
- **Tokens** for verification and reset are random, stored hashed with an expiry, single use. Reset expires after one hour.
- **Mail:** a transport module with a Resend implementation and an injectable capture implementation for tests. Sender is `noreply@formamorph.ai`. The API key and sender live in the server's environment file. DNS records for the domain are the user's step.
- **Rate limits:** in-memory counters per IP and per email on the reset request, verification resend, and email set endpoints. Nothing is persisted or logged.
- **Me** returns the email and its verified state so the account page can render them.

## Testing Decisions

A good test drives the seam an outside caller uses and asserts the observable result. Server tests call routes; client tests render pages or exercise AuthService; nothing asserts internal state.

- **Server routes** are tested at the HTTP seam the existing `tests/*.test.js` files use. New coverage: register with a taken email, verification consume and expiry, reset request for verified, unverified, and unknown accounts (identical responses), reset completion ending other sessions, single-use tokens, and rate limiting. Prior art: the account deletion and avatar tests.
- **The mail transport is the one new seam.** Tests inject the capture transport and assert on the captured message, including the link.
- **AuthService** gains unit tests for the storage listener: a foreign write of the token key signs in, a removal signs out, and the subscriber is notified. Prior art: the existing AuthService test file.
- **Site pages** render in jsdom with the real provider stack the way the main menu tests do: redirect without a session, not-found for an unknown user, age gate before a profile, the `?next=` filter.
- **Playwright** covers the landing header states against the static site server the landing tests already use, and cross-tab sync with two pages in one context: sign in on the site page, assert the app page shows the signed-in menu without a reload, and the reverse for sign-out.
- **Live check:** the deploy's live checks gain a probe that the site entry's routes serve HTML.

## Out of Scope

- Desktop and Android session sync. They run on other origins and keep their own sign-in.
- Opening a world from a profile card. No deep link into the app exists; cards stay display only.
- New profile fields such as a bio or links.
- Login blocked until verification. Accounts work at once.
- Migrating existing users' emails. None exist.
- OAuth or social sign-in.

## Further Notes

- Export shape is untouched. No world or save JSON changes.
- The user's steps: Resend account and API key, DNS records for `formamorph.ai` mail, and the server environment file.
- Server and client tickets ship in parallel where possible. The client's email field and account page depend on the server's email endpoints being deployed first.
