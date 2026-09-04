# Spec: Like moderation (client)

Status: ready-for-agent

Server side: the FormamorphServer repo, `.scratch/like-moderation/spec.md`, already implemented.

## Problem Statement

Staff suspect that some listings climb the catalog on likes from throwaway accounts. The server now exposes who liked a listing, what an account has liked, and lets staff remove likes. The app shows none of it. A staff member who wants to check a suspicious listing today has to sign in with a terminal and call the API by hand, then look up each account separately.

## Solution

Two staff-only views inside surfaces that already exist, and two actions on them.

- **Likers of a listing.** In the listing details modal, the like count becomes a button for staff. It opens a Likers dialog: every account that liked the listing, newest like first, with avatar, name, role badge, status, member-since date, when it liked, and how old the account was at that moment. Each name opens the public profile. Each row has a remove action.
- **Likes given by an account.** The profile dialog gains a Likes tab beside Creations, visible to staff only. It lists every listing the account liked, newest first, with the listing name, its author, a quarantined marker, and the like time. Each listing opens its details. A Clear all button removes every like the account gave.

Removals confirm first, update counts at once, and land in the audit log, which the app's log tab already shows. Two new audit actions get labels, a pill style, and a filter option there.

## User Stories

1. As a staff member, I want the like count on a listing to open a list of likers, so that I can check a suspicious count without leaving the listing.
2. As a staff member, I want each liker's avatar, name, and role badge, so that the list reads like the rest of the app.
3. As a staff member, I want each liker's name to open their public profile, so that I can inspect the account with one click.
4. As a staff member, I want each liker's member-since date, so that I can spot accounts made just before they liked.
5. As a staff member, I want to see how old each account was when it liked, in plain words like "4 minutes old", so that I do not have to compare two dates.
6. As a staff member, I want rows where the account was under a day old at like time to stand out, so that a cluster of fresh accounts is visible at a glance.
7. As a staff member, I want each liker's status shown as the same pill the user list uses, so that I can see which rows I already suspended.
8. As a staff member, I want likers ordered newest like first, so that a fresh burst sits at the top.
9. As a staff member, I want the dialog to say how many likes there are in total, so that I know when the list was cut at the server's cap.
10. As a staff member, I want to remove one like from the list, so that a fake like stops counting.
11. As a staff member, I want a confirmation before a like is removed, so that a mis-click does not undo somebody's real like.
12. As a staff member, I want the row to leave the list and the listing's count to drop right away after a removal, so that I can see the correction took.
13. As a staff member, I want the remove action hidden on a row I cannot moderate, so that the staff ladder is visible rather than discovered by a refusal.
14. As a staff member, I want a clear error toast when the server refuses a removal, so that a stale ladder check does not fail silently.
15. As a staff member, I want the likers of a quarantined listing, so that hiding a listing does not hide the evidence.
16. As a staff member, I want a Likes tab on an account's profile, so that I can see what one account has been liking.
17. As a staff member, I want each liked listing's name and author, so that a cluster around one author is obvious.
18. As a staff member, I want each liked listing to open its details, so that I can jump from the account to the listing and back.
19. As a staff member, I want the author's name on each liked listing to open the author's profile, so that I can follow the cluster to its owner.
20. As a staff member, I want a quarantined listing marked in the Likes tab, so that a like on a hidden listing is shown rather than dropped.
21. As a staff member, I want the like time on each liked listing, so that I can see a batch given in one sitting.
22. As a staff member, I want a Clear all button on the Likes tab, so that a throwaway account's whole footprint goes in one action.
23. As a staff member, I want the Clear all confirmation to say how many likes it will remove, so that I know the size of the action.
24. As a staff member, I want the Likes tab to empty and say so after a clear, so that I can see it took.
25. As a staff member, I want the Clear all button hidden on an account I cannot moderate, so that the ladder is visible up front.
26. As a staff member, I want removed and cleared likes to show in the audit log tab with readable labels, so that the team can see who corrected what.
27. As a staff member, I want to filter the audit log by those two actions, so that I can review like corrections on their own.
28. As a staff member, I want the lists to show skeletons while loading and a plain message when empty, so that a slow server and an unliked listing look different.
29. As a staff member, I want the lists to work with the keyboard and a screen reader, so that the moderation tools meet the same bar as the rest of the app.
30. As an ordinary reader, I want the like count to stay plain text, so that nothing hints that a list exists.
31. As an ordinary reader, I want no Likes tab on any profile, so that who liked what stays private.
32. As a listing author, I want my own listing's count to stay plain text, so that who liked my work stays private.
33. As a signed-out visitor, I want no change at all, so that the browser stays as it is.

## Implementation Decisions

**Vocabulary.** A *like* is one account's revocable mark on a listing. A *liker* is the account behind one like. *Staff* and the *staff ladder* follow the client's roles module, which mirrors the server's.

**Gating.** Every new surface checks the signed-in user with the shared staff predicate. Per-row actions check the shared moderation rule against the target account, using the role carried on the row. A row or button the viewer cannot act on is hidden, not disabled. The server still enforces the ladder; the client mirrors it so the refusal wording never has to appear in the normal path.

**Service layer.** The listing storage service gains two calls: fetch likers of a listing, and remove one like. The user service gains two: fetch likes an account has given, and clear them. All four attach the bearer token and unwrap the server envelope the way the existing calls do. Types for both row shapes live beside the public profile type.

**Server contract.** Likers: `GET /worlds/:id/likes` returns `{ total, rows }` where each row is `{ id, username, avatarUrl, status, createdAt, likedAt, accountAgeAtLikeSeconds }`. Likes given: `GET /users/:id/likes` returns `{ total, rows }` where each row is `{ id, name, authorId, authorUsername, quarantined, likedAt }`. Remove one: `DELETE /worlds/:id/likes/:userId` returns `{ likes }`, the new count. Clear: `DELETE /users/:id/likes` returns `{ removed }`. Lists are capped at 500 rows; `total` is the full count. A ladder refusal is 403 with the server's shared wording.

**Liker row role.** The server's liker row carries status but not role. The client resolves the moderation rule with the role it has: the row is treated as an ordinary account unless the public profile says otherwise. To keep the ladder honest for staff likers, the likers row type includes an optional role, and the server is asked to add `role` to the row in a follow-up. Until then a refused removal surfaces as the error toast in story 14.

**Likers dialog.** A new dialog component, opened from the details modal. The like-count element renders as the existing plain span for everybody except staff; for staff it becomes a button whose accessible name says it opens the likers. The dialog title names the listing. A header line gives the total. Rows are a list, not a table: avatar, clickable username with role badge, status pill, "Member since" date, "Liked" date, and the age phrase. Rows with an age under one day get the warning tint used elsewhere for attention. The remove action is an icon button with a tooltip and an accessible name that includes the username. Removal confirms in the shared confirm dialog, then calls the service, drops the row, decrements the header total, and pushes the new count back to the details modal so the heart updates. Errors go to a toast.

**Age phrase.** Seconds become a coarse relative phrase: minutes under an hour, hours under a day, days under a month, then months or years. Zero or negative reads "same second". One helper, unit tested, shared by the row.

**Likes tab.** The profile dialog's tab strip gains a Likes tab after Creations, rendered only for staff. It fetches on first activation, shows skeletons, then rows: listing name as a button that opens the listing through the profile store's listing opener, the author as the shared clickable username, a quarantined pill when set, and the like date. A Clear all button sits in the tab header, hidden when the viewer cannot moderate the profile's account or when there are no likes. It confirms with the count, calls the service, empties the list, and toasts the number removed.

**Audit log.** The two new actions are added to the client's audit action list, labels, filter options, predicate sentences, and pill styles. A `like_removed` entry reads as the actor removing the target's like on the named listing. A `likes_cleared` entry reads as the actor clearing the target's likes, with the count from the snippet.

**Cache.** The catalog cache keeps a listing's like count. After a removal, the details modal's count update flows through the same path the heart toggle uses today, so the card behind the modal updates too.

**Dev route.** The likers dialog is reachable through the dev navigation helper so it can be opened in the preview without clicking through, and the drift-guard test covers the new entry.

**UI rules.** No DOM title attributes; tooltips through the shared tip component. Text sizes from the role scale only. Both themes checked for the new tint and pills. No animation added.

## Testing Decisions

**One seam: components with services spied.** Every test renders the component under test with Testing Library and spies the service methods, the same way the profile dialog and audit log tab tests do. The signed-in user is set by spying the auth service. No network mocks and no new e2e cases.

**What a good test looks like here.** It renders a surface as a given role, then asserts what that role sees and what happens when they act: which rows appear, in what order, which buttons exist, what the service was called with, and what the screen shows afterward. It never reaches into component state.

**Coverage to write.**

- Details modal: like count is a plain span for a reader, the author, and a signed-out viewer; a button for staff. Clicking it opens the likers dialog with the listing's id.
- Likers dialog: rows render every field newest first, the total shows, rows under a day old carry the tint, older rows do not. Username opens the profile store. Remove asks, calls the service with listing and user ids, drops the row, and reports the new count to the parent. A refused removal shows the toast and keeps the row. Empty list shows the empty message. Loading shows skeletons.
- Age phrase helper: boundaries at one hour, one day, one month, one year, and the zero case.
- Profile dialog: no Likes tab for a reader; a Likes tab for staff. The tab fetches on first activation only. Rows carry name, author, quarantined pill, and date. Listing name calls the listing opener. Clear all is hidden without likes and for an account the viewer cannot moderate; otherwise it confirms with the count, calls the service, empties the list, and toasts.
- Audit presentation: both new actions have a label, a style, a filter option, and a readable sentence.
- Dev route drift guard passes with the new entry.

**Prior art.** The profile dialog test for service spies and the signed-in reader. The quarantine card test for role fixtures and staff-only controls. The audit log tab test for filter wiring. The takedown browser test for capturing props passed to a stubbed modal.

**Bar.** Coverage is measured, not guessed. Each gating test is checked to fail when its gate is removed. No fixture is shaped so a check cannot fire. Typecheck, lint, test, and build all pass, then the code graph is updated.

## Out of Scope

- Any new admin panel tab or search for likes.
- Paging or client-side sorting of either list.
- Automatic flagging beyond the one-day tint. The judgment stays with staff.
- Bulk removal of several likes on one listing.
- Changing how suspension works or what a suspended account can do.
- Server changes, except the requested follow-up to add `role` to the liker row.

## Further Notes

The glossary in this repo has no entries yet for Like, Quarantine, Profile, or Staff. This work should add Like at least, matching the server's wording: one account's revocable mark on a listing, where the room sees only the count and staff see the likers.

Because the liker row lacks a role today, the ladder check on a staff liker cannot be mirrored on the client. The one-line server follow-up closes that gap; the error toast covers it in the meantime.
