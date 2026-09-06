# 05 — Account page: password, avatar, delete

Status: ready-for-human
Status note: Password/avatar/delete and email sections implemented; review stage. Site navigation, sign-out, and deletion-cancellation notice remain in ticket 09.
Spec: ../spec.md

**What to build:** A signed-in player opens `/account`, changes their password, uploads a new avatar, or deletes the account with password confirmation. Signed-out visitors are sent to sign in and come back.

**Blocked by:** 01.

- [x] `/account` requires a session; otherwise it redirects to `/login?next=/account`.
- [x] Change password, avatar upload, and delete account use the existing AuthService calls and match the app's rules and copy.
- [x] Deletion signs out both surfaces through the shared keys.
- [x] An avatar change updates the shared user record so the header and the app pick it up.
- [x] jsdom tests: redirect when signed out; each action calls its endpoint and reflects the result.

## Comments

**Done, and looked at live.** `/account` is a fourth fixed route on the site entry, at
[AccountPage.tsx](../../../../site/pages/AccountPage.tsx), with 15 jsdom tests beside it.

### What was reused rather than rewritten

The ticket asks the actions to "match the app's rules and copy". The surest way to match copy is to be
the same component, so the page mounts the game's own
[DeleteAccountDialog.tsx](../../../../src/components/menu/DeleteAccountDialog.tsx) and
[ProfileAvatarEditor.tsx](../../../../src/components/menu/ProfileAvatarEditor.tsx) — the seven days, the choice
about published work, the password step, and the crop circle are one implementation, not two that have
to be kept saying the same thing. Only the change-password form is written here, because the app's is a
dialog and this is a section of a page; its copy and its two rules are lifted from
[AuthModals.tsx](../../../../src/components/menu/AuthModals.tsx).

### The one seam that reuse cost

Both reused controls reported through `react-toastify`. The site mounts no toast container, and it
should not: the game's is `ThemedToastContainer`, which reads a `ThemeProvider` the site deliberately
does not mount — the site is dark-only, and mounting the provider would write the app's own
`vite-ui-theme` key from a page that has no theme picker.

So the reporting channel is now a prop. `ProfileAvatarEditor` takes `notify(message, kind)` and
`AvatarCropDialog` takes `onError(message)`; the game passes a toast reporter, the site passes a setter
that writes a line under the control. Both are required rather than defaulted, so no call site can
forget one and report into nothing.

### A bug the jsdom tests could not see

The first live run of the delete flow ended at `/login?next=%2Faccount`. The page recomputed
`isAuthenticated()` on every render, so the deletion ending the session re-armed the signed-out
redirect — and signing in is exactly what calls a deletion off. The session state is now read once on
arrival. The test that missed it asserted `leaveTo` had been called with `'/'`; it now asserts the whole
call list, which is what catches a second, wrong destination.

### The other thing live checking found

`tailwind.site.config.js` scanned only `site/**` and `src/components/ui/**`, so **no** reused app
component's classes reached the site stylesheet. This predates this ticket — ticket 04 did not see it
because `ProfilePage` passed its avatar sizing inline — and the failure is silent: the control renders,
type-checks and passes its tests, it is simply missing the classes it asked for. An avatar's
`h-16 w-16` circle came out a `w-16` oval.

The list now lives in [tailwind.site.content.cjs](../../../../tailwind.site.content.cjs) (apart from the config so a
test can read it — the configs are CommonJS inside an ESM package, which Vitest cannot import), and
[bundleBoundary.test.ts](../../../../site/bundleBoundary.test.ts) gained a sixth test that walks the site's imports
and fails when a reachable file is not in the scan. Proven to bite by dropping `UserAvatar` from the
list.

### What was checked live

Against a throwaway mock API, at 1024×1000 and at 375×812:

| Case | Result |
|---|---|
| `/account` signed out | went to `/login?next=%2Faccount` |
| Wrong current password | "Current password is incorrect", inline, boxes kept |
| Right current password | success line, boxes emptied, replacement token adopted |
| Delete, to the confirmation | both shared keys `null`, page still on `/account` |
| Delete, then Done | left for `/` |
| Avatar save | `currentUser.avatarUrl` written, `<img>` resolved against the API origin |
| Suspended account | banner shown, every write control disabled, delete flow still reachable |

### Deliberately not done

- **Email.** Ticket 06 owns it and is now implemented.
- **Sign out.** The page has no sign-out button, and neither does the landing header or `SiteLayout`.
  The earlier claim that ticket 02 supplied one was incorrect. [Ticket 09](09-site-account-controls.md) tracks this gap and the missing normal navigation into `/account`.
- **Followers, messages, published work.** Those are the public profile's, at `/u/<name>`.

### Noted in passing, not fixed

`LikeButton` reaches the site bundle through `UserCreationsTab` and imports `react-toastify`, so the
library is in the site's JavaScript even though nothing there can raise a toast — `UserCreationsTab`
passes no `onToggle`, so the path is unreachable. It is dead weight, not a bug, and it arrived with
ticket 04.

### What the review changed

Both axes ran against the working tree. Findings acted on:

- **🐞 `fs.globSync` is Node 22+, and this repo supports 20.19.** The new scan guard used it, so it
  would have thrown a `TypeError` on a Node the repo promises to run — CI is green only because the
  workflows read `.nvmrc` (24). Verified against the live Node 20 API docs, which do not list it. The
  content list is now plain paths in two arrays, and the guard matches by prefix and exact string, so
  nothing globs.
- **🐞 The delete dialog named a button the site does not have.** A suspended reader was told to "Ask
  through Feedback" beside an **Open Feedback** button that only renders when the host supplies an
  opener, and the site has no Feedback hub. The sentence now names the game when there is no button.
- **The suspension rule was said in one place, not two.** The game says it at the page level *and*
  again by the password boxes. The page now does both.
- **The sign-in return path was a third hand-encoded copy.** `signInTo(path)` in
  [nextPath.ts](../../../../site/nextPath.ts) owns the encoding; `/account` and `/profile` both call it, with a
  round-trip test through `safeNextPath`.
- **Avatar removal was tested only at the component.** It is an action on this page, so it has a
  page-level test that the shared record is cleared.
- `AvatarCropDialog` assigned its reporter ref during render and still called `onError` directly from
  the save handler. The assignment moved into an effect, and both paths go through the ref.
- The `avatarUrl` cast carries its one-line reason.

Declined, with reasons:

- **"Two hand-kept lists" (`ALLOWED` and the content list).** They answer different questions — one is
  what a site file may *name*, the other is every file reached through those names — so neither can be
  derived from the other. The scan guard is what keeps them consistent.
- **"Suspended-account handling was not asked for."** The box asks the actions to match the app's
  rules, and refusing a suspended account's writes is one of them.
