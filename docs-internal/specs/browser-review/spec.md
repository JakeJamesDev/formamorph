# Spec: Browser review (client)

Status: done
Status note: Closed 2026-10-28. Tickets 01–06 done, last landing b68daa517 (server 6349237). Review: spec text corrected. Gates green on 2026-10-28.
Spec session: browser-review — spec

Server side: the FormamorphServer repo, `docs-internal/specs/browser-review/spec.md`. It adds the pending preview to catalog rows. This spec follows the Listing Review rulings (`docs-internal/specs/listing-review/`).

## Problem Statement

Mods and admins review listings only from **Admin Panel → Moderation → Review**. In Community Creations, staff already receive pending listings in the catalog. They sit mixed into the normal list, so a mod can't tell at a glance what waits for review. A listing with a pending update shows its live version, so the change under review is not visible. To approve or reject, staff must leave the browser for the Review tab.

## Solution

- **Pinned group.** In Community Creations, staff see every listing that awaits review pinned above the normal results. This covers new listings, resubmitted listings and approved listings with a pending update. The group is one run, oldest-queued first.
- **Decide on the card.** A pinned card has a check and an X.
  - The check approves in one click.
  - The X on a new listing opens the same quarantine-days dialog as the Review tab, then the message composer.
  - The X on an update opens the same confirm as the Review tab, then the update-rejection composer.
- **Pending face.** A pinned update card shows the pending name and the pending thumbnail.
- **Filters apply.** The pinned group follows the current kind, search and filters. It shows on page 1 only.
- **Show Pending.** A staff-only toggle hides the pinned group and shows the player view. It is on by default and remembered per device.
- **Compare for staff.** The details modal shows staff the **Pending Update** section with **Compare**. **Discard Update** stays author-only.

## User Stories

1. As a mod, I want listings that wait for review pinned at the top of Community Creations, so that I see them without opening the Admin Panel.
2. As an admin, I want the same pinned group, so that I can review while I browse.
3. As a player, I want the browser unchanged, so that I never see listings that are not approved.
4. As a mod, I want new listings and pending updates in one group, oldest-queued first, so that the order matches the Review queue.
5. As a mod, I want a resubmitted listing in the pinned group, so that a fixed listing gets a second look.
6. As a mod, I want a check on a pinned card that approves at once, so that a clean listing goes live in one click.
7. As a mod, I want the X on a new listing to ask for the quarantine days, so that the rejection has the same deadline as one from the Review tab.
8. As a mod, I want the message composer to open after I reject, so that the author hears why.
9. As a mod, I want the X on an update to confirm before it drops the update, so that a misclick does not throw away an author's edit.
10. As a mod, I want the update-rejection template in the composer after I reject an update, so that the author knows the live version stays.
11. As a mod, I want an approved card to leave the pinned group and join the normal list, so that the group holds only open work.
12. As a mod, I want a rejected new listing to leave the pinned group, so that it shows only under the Quarantined view.
13. As a mod, I want a rejected update's card to return to its live version in its normal slot, so that the list matches what players see.
14. As a mod, I want an update card pinned on top and not also in its normal slot, so that one listing shows once.
15. As a mod, I want a pinned update card to show the pending name and thumbnail, so that I judge the change, not the live version.
16. As a mod, I want the Update Pending badge on that card, so that I know players still see the old version.
17. As a mod, I want the pinned group to follow kind, search and filters, so that I can review one kind or one author.
18. As a mod, I want the pinned group on page 1 only, so that later pages show only normal results.
19. As a mod, I want a Show Pending toggle, so that I can see the browser the way players see it.
20. As a mod, I want Show Pending on by default, so that pending work is visible without setup.
21. As a mod, I want Show Pending remembered on this device, so that my choice survives a restart.
22. As a mod, I want the player view with Show Pending off to hide new pending listings and show updates in their live form, so that it matches what players see.
23. As a mod, I want no check or X on my own pending listing, so that I can't approve my own work.
24. As a mod, I want no check or X on a listing whose author I can't moderate, so that the card offers only what the server allows.
25. As a mod, I want a toast when another mod already decided the item, so that I know why the card changed.
26. As a mod, I want a locked contest update to stay pinned with a toast, so that I know it waits for the contest.
27. As a mod, I want the check and X disabled while a decision is in flight, so that I can't send it twice.
28. As a mod, I want to open a pinned card's details, so that I can read the full listing before I decide.
29. As a mod, I want the details modal to show me the Pending Update section with Compare, so that I see the live and pending values side by side before I approve.
30. As a mod, I want no Discard Update button in that section, so that I reject through the review flow with a message.
31. As an author, I want my Pending Update section unchanged, so that I can still compare and discard.
32. As a mod, I want the Review tab to behave as it does today, so that both places decide the same way.

## Implementation Decisions

**Rulings (grill 2026-10-27)**

- Q1. Mods and admins see the pinned group.
- Q2. Pending cards pin above the normal list.
- Q3. New listings and pending updates both get the check and X.
- Q4. The X on a new listing reuses the Review tab flow: the quarantine-days dialog, then the composer.
- Q5. The pinned group follows kind, search and filters, and shows on page 1 only.
- Q6. A staff-only **Show Pending** toggle, on by default, remembered per device.
- Q7. The check approves in one click.
- Q8. The X on an update reuses the Review tab's update flow: confirm, then the update-rejection composer.
- Q9. A pending update's card moves to the pinned group. It does not also show in its normal slot.
- Q10. Staff see the details modal's Pending Update section with Compare, without Discard Update.
- Q11. Community Creations browser only.
- Q12. A pinned update card shows the pending name and thumbnail.
- Q13. One pinned group, oldest-queued first.
- Q14. The pinned group is an "Awaiting Review" heading above the same card grid, with a divider before the normal results. No tinted panel.
- Q15. Pinned cards show the moderation badge as its title only ("Pending Review", "Update Pending"), without the description. Every other card keeps the full badge.

**Modules**

- **Review decision hook.** The approve and reject orchestration moves out of the Review tab into one shared hook. It owns the busy state, the 409 conflict handling (`CONTEST_LOCKED` keeps the item; any other conflict drops it with "Another mod already handled this item"), the quarantine-days dialog for a new listing, the confirm for an update or a resubmitted listing, and the composer with the right template. It also owns the "may decide" check: not the viewer's own listing, and `canModerate` against the author. The Review tab and the browser both use it. It reports each outcome (approved, rejected, dropped by conflict, kept by contest lock) so each caller updates its own list.
  - Shape (ticket 02 ruling): it takes a `ReviewSubject` (the queue item's id, kind, name, type and author) and returns `busyId` (the subject in flight, or null), `mayDecide`, `approve`, `startReject` and `dialogs`, which the caller renders. Toasts stay inside the hook. The browser maps a catalog row to a `ReviewSubject`. The item dialog, download and queue list stay in the Review tab.
- **Browser pipeline.** The filter hook splits its sorted result into the pinned group and the normal rows when the viewer is staff and Show Pending is on.
  - Membership uses the existing `awaitsReview` predicate (pending, resubmitted, updatePending). `awaitsFirstReview` (pending, resubmitted) picks the rows the player view drops. `reviewQueuedTime` gives the sort key, and `pendingFaceOf` holds the pending-face rule for the card and search.
  - The pinned group sorts by queue time ascending, then id, ignoring the browser's sort. A new or resubmitted row uses `moderation_queued_at`. An update row uses `pending_preview.queued_at`, falling back to `updated_at` (ticket 03 ruling).
  - Hide preferences (hidden listings, tags, authors) apply to the pinned group like any filter.
  - Search matches the name the card shows: a pinned update card's `pending_preview.name`, otherwise the live name (ticket 05 ruling).
  - The paged slice comes from the normal rows only. The pinned group renders above the page 1 grid as its own section and does not count toward page size.
  - With Show Pending off, staff get the player view: new pending and resubmitted listings by other authors are dropped. Update Pending rows stay in their normal slot with their live face. The viewer's own pending listings stay in their normal slot with their badge.
  - A non-staff viewer sees what the server sends today: their own pending listings with the Listing Review badges, no pinned group.
  - The Quarantined view and the contest tab show no pinned group and no Show Pending control. The contest tab is unchanged (Q11).
- **Show Pending.** A `usePersistentState` boolean under `FORMAMORPH_communityShowPending`, default true. A toggle beside the staff-only Quarantined toggle, styled like it (outline when off, filled when on): label "Show Pending", Eye icon, tip "Show listings that wait for review". It shows for staff when moderation is available, regardless of count.
- **Card.** `RemoteWorldCard` takes `inReviewGroup`, which drives the pending face and the title-only badge (Q15), plus optional `onApprove` and `onReject` callbacks and `reviewBusy`. The browser passes the callbacks only for pinned cards the viewer may decide. The hook decides one subject at a time, so every pinned card's check and X disable while any decision is in flight. The buttons sit in the existing staff action row. A pinned update card reads its name and thumbnail from the row's pending preview. The thumbnail loads through `usePendingThumbnail`. It falls back to the live thumbnail while loading or on error.
- **After a decision.** The browser patches the row at once. Approve sets the row approved and clears the pending update, taking the pending name. Approve on a resubmitted listing also clears its quarantine. Reject on a new listing sets it rejected and quarantined. Reject on a resubmitted listing keeps its quarantine and deadline. Reject on an update clears the pending update. A conflict drop removes the row. Then the catalog re-syncs with its stored ETag, after every outcome, without applying the cached rows or showing the skeleton (ticket 04 rulings).
- **Card buttons.** The check (tip "Approve and show it to players") and the X (tip "Reject and message the author") lead the staff action row.
- **Details modal.** The Pending Update section shows for the author, or for staff where moderation is available. `viewerIsAuthor` (default true) hides Discard Update for anyone else and words the description for a staff reader.
- **Catalog row shape.** The listing service passes through the server's new `pending_preview` field on catalog rows: `{ name, queued_at, thumbnail_url? }`, present only when the row has a pending update and the viewer is staff or the author. See the server spec for the contract. The client type keeps `queued_at` optional and falls back to `updated_at`.
- **Dev route.** The browser's staff view with a pinned group gets a `devRoutes` entry backed by the existing dev review stub. In DEV and for that fixture only, it prepends canned pending catalog rows built from the review fixtures and presents the viewer as staff.

## Testing Decisions

- Test behavior through the highest seam: render the browser or the card, act as a user, read the DOM. Do not test the hook's internals through the browser.
- **Browser** (`CommunityCreationsBrowser.*.test.tsx` pattern): the pinned group shows for staff only; it follows kind, search and filters; it shows on page 1 only and does not shrink the page; it orders by queue time; an update row shows once; Show Pending off gives the player view and survives a remount; approve and reject move the card where the stories say.
- **Card** (`RemoteWorldCard.quarantine.test.tsx` pattern): check and X show only when the callbacks are passed; they disable while busy; a pinned update card shows the pending name and thumbnail and falls back to the live one on a failed load.
- **Review decision hook:** one test file covers approve, reject of a new listing with days, reject of an update, both conflict cases and the composer template. The existing `ReviewTab` tests stay green with no weakened assertions; they prove the extraction kept behavior.
- **Details modal** (`RemoteWorldDetailsModal.pendingUpdate.test.tsx`): staff see the section and Compare, without Discard Update; the author still sees Discard Update.
- Each guard gets one check that fails when its condition is removed (for example, a non-staff viewer must never see another author's pending row).

## Out of Scope

- Contest entry lists, profiles and the author's creations tab (Q11).
- Changes to the Review tab beyond the hook extraction.
- A count of pending items in the browser.
- Any change to world or save export shape.

## Further Notes

- The server ticket must land and deploy before the pending face (Q12) works. Without `pending_preview`, an update card falls back to its live face.
- Changelog: none. Staff and moderation tools stay out of the player changelog (user ruling at the close).
