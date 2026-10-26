# Spec: Listing review (client)

Status: done
Status note: Closed 2026-10-26. Tickets 01–10 done, last landing f63b3e283; ticket 11 (deploy and switch-on) stays with the user. Review: spec text corrected; two small gaps fixed (formamorph 2d44108c0, FormamorphServer 7884f50). Gates green on 2026-10-26.
Spec session: listing-review — spec

Server side: the FormamorphServer repo, `docs-internal/specs/listing-review/spec.md`. That spec holds the rulings (Q1–Q28), the moderation states and the API contract. This spec follows them.

## Problem Statement

The server will hold new listings and updates for review before players can see them. The app shows none of that. An author who publishes sees no sign that the listing is waiting, so a listing that players cannot see looks broken. Mods have no queue to work from. Admins have no control for trust or for the review setting.

## Solution

- **Authors** see a badge on a listing that is waiting:
  - **Pending Review** on a new listing that waits for review.
  - **Update Pending** on an approved listing whose update waits for review.
  - **Resubmitted** on a rejected listing the author fixed and sent back. It keeps the quarantine deadline.
- **Publish and update** say whether the item went to review. The author can compare the live version with the pending update, and can discard the pending update.
- **Mods** get a **Review** tab in the staff panel, with the waiting count in its label. It lists the queue in server order. Each item opens a detail view with:
  - the changed fields side by side;
  - the pending thumbnail;
  - the changelog operations;
  - a content download;
  - **Approve** and **Reject** actions.
- **Rejecting** a new listing opens the existing quarantine dialog. Rejecting an update asks for confirmation. Both then open the message composer at once, as quarantine does today (Q22, Q27). A resubmission is rejected without a length choice, because it keeps its deadline (Q24).
- **Auto-approvals** get a second view that lists recent ones for spot checks.
- **Admins** get a trust toggle on each account in the Users tab, and a **Listing Review** switch in the server settings tab.
- **Old servers:** against a server without review, every control stays hidden.

## User Stories

1. As an author, I want a message after publishing that says my listing went to review, so that I know players cannot see it yet.
2. As an author, I want a Pending Review badge on my waiting listing, so that I can tell it apart from a live one.
3. As an author, I want an Update Pending badge on a live listing with a waiting update, so that I know players still see the old version.
4. As an author, I want a Resubmitted badge with the deadline on a fixed rejected listing, so that I know it is back in review and how long I have.
5. As an author, I want to compare the live version with my pending update, changelog included, so that I know what will change.
6. As an author, I want to discard my pending update, so that I can withdraw an edit.
7. As an author, I want a changelog entry I add to a live listing to show as pending, so that I know players do not see it yet.
8. As an author, I want my rejected listing to show the existing quarantine notice and deadline, so that I know what happened.
9. As an author, I want my pending contest entry to show that it is entered and waiting, so that I know it holds my slot.
10. As a trusted author, I want publish to say the listing is live, so that I do not wait for a review that will not happen.
11. As a mod, I want a Review tab with the waiting count in its label, so that I see waiting work without opening the tab.
12. As a mod, I want queue items in the server's order, contest entries first, so that I work on the most urgent item first.
13. As a mod, I want each item to show its kind, name, author, age and type (new, update or resubmitted), so that I can pick one quickly.
14. As a mod, I want a contest marker on contest entries, so that I know why they sit at the top.
15. As a mod, I want an update's changed fields shown with the live and pending values side by side, so that I review only the change.
16. As a mod, I want a changed thumbnail shown as both images, so that I can check the image itself.
17. As a mod, I want to see the changelog operations in an update, so that changelog text gets reviewed too.
18. As a mod, I want to download the pending content, so that I can open the actual file.
19. As a mod, I want to approve with one button, so that clean content goes live quickly.
20. As a mod, I want to reject a new listing through the quarantine dialog I already know, so that I pick the length the usual way.
21. As a mod, I want to reject a resubmission without a length choice, so that I am not offered a deadline that will not apply.
22. As a mod, I want a confirmation before I reject an update, so that a misclick does not drop an author's work.
23. As a mod, I want the message composer to open after any rejection, so that the author learns what to fix.
24. As a mod, I want a clear message when an approval must wait for contest results, so that I know why it did not go through.
25. As a mod, I want the item to leave the queue and the count to drop after I act, so that I can see the action worked.
26. As a mod, I want a clear message when another mod already handled the item, so that a stale queue does not fail without a word.
27. As a mod, I want approve and reject hidden on an item I cannot moderate, so that the staff ladder is visible and not found by a refusal.
28. As a mod, I want a list of recent auto-approvals that opens each listing, so that I can spot-check trusted and staff uploads.
29. As a mod, I want review actions labeled in the audit log tab, so that the log reads cleanly.
30. As an admin, I want a trust toggle on each account in the Users tab, so that I can grant and revoke trust where I already manage accounts.
31. As an admin, I want a trusted marker on trusted accounts in the user list, so that I see who skips review.
32. As an admin, I want a Listing Review switch in server settings, so that I can turn review on and off without a deploy.
33. As an admin, I want the switch's help line to say that pending items stay in the queue, so that I know what turning it off does.
34. As a mod, I want the trust toggle hidden from me, so that I am not offered an action only admins can take.
35. As a player on an old server, I want no review controls to show, so that the app does not offer what the server cannot do.

## Implementation Decisions

- **Rules module.** A new pure module holds the rules the views share:
  - a listing's display status: `live`, `pending`, `updatePending`, `rejected` or `resubmitted`. It reads `moderation_state`, `has_pending_update` and the quarantine fields;
  - the changed-field list for an update;
  - the labels.

  Views read status only through this module. It sits beside the quarantine rules module and reuses its date helpers. "Review state" stays the add-on offer term (`ReviewState`, `setAddonReview`), so the new code says "moderation" in names.
- **Service.** A new service wraps the review, trust and meta routes. The listing service passes through `moderation_state`, `has_pending_update` and `pending_update`.
- **Feature detection.** The client calls `GET /api/reviews/meta` and treats a `404` as "absent", the same way reports work. A transient failure (401, network) is not cached as "absent".
- **Author surfaces.**
  - The listing card, the details modal and the author's creations tab show the badges.
  - The badges reuse the quarantine marker pattern with new text.
  - The details modal gets a **Pending Update** section for the author, with **Compare** and **Discard Update**. The pending thumbnail loads from the review thumbnail URL the server sends.
- **Publish result.** The publish and update calls read the server's answer. A pending result shows "Sent for review". A live result keeps today's message. The changelog entry that the publish modal posts after an update becomes part of the pending update on the server. The modal shows the entry as pending.
- **Review tab.**
  - Reports and Review share one **Moderation** tab in the staff panel, split by a segmented control (the user's ruling for ticket 08). The tab count stays at 8 for admins and 5 for mods.
  - The panel's width cap rises from 900px to 1000px. The tab breakpoints and `admin-panel-widths.spec.ts` change to match.
  - Review shows for anyone who passes `canModerate` on a server that supports review. **Auto-Approved** is a third segment beside Reports and Review, with no count (the user's ruling for ticket 10).
  - The admin-only Trusted toggle sits in the user row's caret menu and is hidden on staff rows. The Trusted pill shows on any row with `trustedAt`.
  - Each segment's label carries its own count: Reports (n) and Review (n). The Moderation tab label has no count, so it fits the 1000px strip in every font (ticket 08 measured a summed count overflowing in OpenDyslexic).
  - The Admin Panel button's badge in the main menu adds the waiting-review count to the open-report count.
  - Rejecting a resubmission leaves out the template's extension sentence when the answer says `quarantineExtended: true`.
- **Item detail.** A dialog shows the item. For an update, a field table shows live and pending values. Thumbnails show as images. The changelog operations show as a list. **Download** fetches the pending content.
- **Reject flow.**
  - **New listing:** `QuarantineDialog` → the reject route with the chosen days → the composer opens with the quarantine template, filled from the route's answer.
  - **Resubmission:** a confirmation → the reject route → the same composer and template.
  - **Update:** a confirmation → the reject route → the composer opens with a new template for a rejected update.
  - If the mod closes the composer, no message goes out.
- **Ticket 09 rulings.**
  - The client field keys use the server's names: `required_dependencies` and `compatible_worlds`. `thumbnail` comes from `thumbnail_url` and `content` from `content_changed`.
  - Dependency and compatibility ids show as listing names, with "Removed listing" on a `404` and Added or Removed tags.
  - One `PendingUpdateTable` serves the author's Compare and the mod's item dialog.
  - A held changelog create shows in the success toast and with a Pending tag in the author's Changelog panel.
  - A `409` with `CONTEST_LOCKED` keeps the row and shows the judging toast. Any other `409` drops the row.
- **Approval refused during judging.** A `409` during judging shows a toast that the approval waits for contest results.
- **Admin controls.**
  - The Users tab gets a **Trusted** toggle and a marker, both for admins only.
  - The admin-only server settings tab gets a **Listing Review** switch with a help line.
- **Audit log.** The seven new audit actions get labels, a pill style and filter entries. An entry with a `target_id` opens the listing.
- **Dev routes.** The Review tab, the item dialog and the author's Pending Update section each get an entry in `devRoutes`.
- **Design.** The badges and the side-by-side field table follow the Design System. If either needs a new visual pattern, the user approves it before it ships.
- **Copy.** Labels use AP title case. Help lines follow the Writing Guide. Run a copy sweep before landing.
- **Export shape.** No change to world or save export. The review fields come from the server and are never written into a world file.

## Testing Decisions

- Two seams, both existing:
  - **The rules module**, tested as pure functions: display status for each server shape, including `resubmitted`, the changed-field list, and the labels.
  - **The Review tab** with a mocked service, in the same harness as the Reports tab tests. It covers:
    - queue order as served;
    - approve;
    - the three reject flows, each ending with the composer open on the right template;
    - the `409` cases: the item was already handled, and judging is under way;
    - the staff ladder hiding actions;
    - the count dropping after an action.
- Author badges are tested through the card's existing quarantine test file pattern.
- Feature detection is tested for absent, present, and a transient failure.
- The admin panel width spec runs again with the new tab.
- Each new async write in a component checks `useMountedRef` and cancels at unmount. A test unmounts mid-request.
- Prior art: `ReportsTab` tests, `RemoteWorldCard.quarantine.test.tsx`, `UserCreationsTab.test.tsx`, the `useReportsEnabled` tests, and `admin-panel-widths.spec.ts`.

## Out of Scope

- Rejection reasons or categories (Q18).
- Review of comments or profiles (Q2).
- A message to the author on approval (Q15).
- Any change to world or save export shape.

## Further Notes

- Ship this client before the operator turns the server's `listing_review` setting on. The setting defaults to off.
- Changelog: one **Listing Review** group under 👤 User-facing, with one entry per client ticket. The changelog has no staff bucket, so the mod and admin entries sit in the same group.
