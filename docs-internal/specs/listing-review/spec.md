# Spec: Listing review (client)

Status: ready-for-agent

Server side: the FormamorphServer repo, `docs-internal/specs/listing-review/spec.md`. That spec holds the rulings (Q1–Q22), the review states and the API contract. This spec follows them.

## Problem Statement

The server will hold new listings and updates for review before players can see them. The app shows none of that. An author who publishes sees no sign that the listing is waiting, so a listing that players cannot see looks broken. Mods have no queue to work from. Admins have no control for trust or for the review setting.

## Solution

- **Authors** see a **Pending Review** badge on a waiting listing, and an **Update Pending** badge on an approved listing whose update is waiting. Publish and update confirm that the item went to review. The author can compare the live version with the pending update and can discard the pending update.
- **Mods** get a **Review** tab in the staff panel with a count badge. It lists the queue in server order. Each item opens a detail view with the changed fields side by side, a content download, and **Approve** and **Reject** actions. Rejecting a new listing opens the existing quarantine dialog. Rejecting an update asks for confirmation. Both then offer a message to the author, as quarantine does today (Q22). A second view lists recent auto-approvals for spot checks.
- **Admins** get a trust toggle on each account in the Users tab and a **Listing Review** switch in the server settings tab.
- Against a server without review, every control stays hidden.

## User Stories

1. As an author, I want a message after publishing that says my listing went to review, so that I know players cannot see it yet.
2. As an author, I want a Pending Review badge on my waiting listing, so that I can tell it apart from a live one.
3. As an author, I want an Update Pending badge on a live listing with a waiting update, so that I know players still see the old version.
4. As an author, I want to compare the live version with my pending update, so that I know what will change.
5. As an author, I want to discard my pending update, so that I can withdraw an edit.
6. As an author, I want my rejected listing to show the existing quarantine notice and deadline, so that I know what happened and how long I have.
7. As an author, I want an edit to my rejected listing to show Pending Review again, so that I know it went back to review.
8. As an author, I want my pending contest entry to show that it is entered and waiting, so that I know it holds my slot.
9. As a trusted author, I want publish to say the listing is live, so that I do not wait for a review that will not happen.
10. As a mod, I want a Review tab with a count badge, so that I see waiting work without opening the tab.
11. As a mod, I want queue items in the server's order, contest entries first, so that I work on the most urgent item first.
12. As a mod, I want each item to show its kind, name, author, age and whether it is new or an update, so that I can pick one quickly.
13. As a mod, I want a contest marker on contest entries, so that I know why they sit at the top.
14. As a mod, I want an update's changed fields shown with the live and pending values side by side, so that I review only the change.
15. As a mod, I want to see a changed thumbnail as both images, so that I can check the image itself.
16. As a mod, I want to download the pending content, so that I can open the actual file.
17. As a mod, I want to approve with one button, so that clean content goes live quickly.
18. As a mod, I want to reject a new listing through the quarantine dialog I already know, so that I pick the length the usual way.
19. As a mod, I want a confirmation before I reject an update, so that a misclick does not drop an author's work.
20. As a mod, I want an offer to message the author after any rejection, so that the author learns what to fix.
21. As a mod, I want the item to leave the queue and the badge to drop after I act, so that I can see the action worked.
22. As a mod, I want a clear message when another mod already handled the item, so that a stale queue does not fail without a word.
23. As a mod, I want approve and reject hidden on an item I cannot moderate, so that the staff ladder is visible and not found by a refusal.
24. As a mod, I want a list of recent auto-approvals that opens each listing, so that I can spot-check trusted and staff uploads.
25. As a mod, I want review actions labeled in the audit log tab, so that the log reads cleanly.
26. As an admin, I want a trust toggle on each account in the Users tab, so that I can grant and revoke trust where I already manage accounts.
27. As an admin, I want a trusted marker on trusted accounts in the user list, so that I see who skips review.
28. As an admin, I want a Listing Review switch in server settings, so that I can turn review on and off without a deploy.
29. As an admin, I want the switch's help line to say that pending items stay in the queue, so that I know what turning it off does.
30. As a mod, I want the trust toggle hidden from me, so that I am not offered an action only admins can take.
31. As a player on an old server, I want no review controls to show, so that the app does not offer what the server cannot do.

## Implementation Decisions

- **Rules module.** A new pure module holds the review rules the views share: a listing's review status for display (`live`, `pending`, `updatePending`, `rejected`), the changed-field list for an update, and the labels. Views read status only through it. It sits beside the existing quarantine rules module and reuses its date helpers.
- **Service.** A new review service wraps the server's review, trust and count routes. The listing service passes through `review_state` and `pendingUpdate`.
- **Feature detection.** The client detects the review routes the same way reports detect `/reports/meta`. A transient failure (401, network) is not cached as "absent".
- **Author surfaces.** The listing card, the details modal and the author's creations tab show the badges. The badge reuses the existing quarantine marker pattern with new text. The details modal gets a **Pending Update** section for the author with **Compare** and **Discard Update**.
- **Publish result.** The publish and update calls read the server's answer. A pending result shows "Sent for review". A live result keeps today's message.
- **Review tab.** A new tab in the staff panel, visible to anyone who passes `canModerate`. It has two views: **Queue** and **Auto-Approved**. The count badge reads the count route, like the reports badge.
- **Item detail.** A dialog shows the item. For an update, a field table shows live and pending values; thumbnails show as images. **Download** fetches the pending content.
- **Reject flow.** A new listing → `QuarantineDialog` → reject route with the chosen days → the existing message offer. An update → confirmation → reject route → the same message offer.
- **Admin controls.** The Users tab gets a **Trusted** toggle and a marker, both for admins only. The server settings tab gets a **Listing Review** switch with a help line.
- **Audit log.** The seven new audit actions get labels, a pill style and filter entries.
- **Dev routes.** The Review tab, the item dialog and the author's Pending Update section each get an entry in `devRoutes`.
- **Design.** The badges and the side-by-side field table follow the Design System. If either needs a new visual pattern, the user approves it before it ships.
- **Copy.** Labels use AP title case. Help lines follow the Writing Guide. Run a copy sweep before landing.
- **Export shape.** No change to world or save export. The review fields come from the server and are never written into a world file.

## Testing Decisions

- Two seams, both existing:
  - **The rules module**, tested as pure functions: status for each server shape, the changed-field list, and labels.
  - **The Review tab** with a mocked service, in the same harness as the Reports tab tests. Tests cover queue order as served, approve, both reject flows ending at the message offer, `409` handling, the ladder hiding actions, and the badge count dropping.
- Author badges are tested through the card's existing quarantine test file pattern.
- Feature detection is tested for absent, present, and a transient failure.
- Each new async write in a component checks `useMountedRef` and cancels at unmount. A test unmounts mid-request.
- Prior art: `ReportsTab` tests, `RemoteWorldCard.quarantine.test.tsx`, `UserCreationsTab.test.tsx`, and the `useReportsEnabled` tests.

## Out of Scope

- Rejection reasons or categories (Q18).
- Review of comments or profiles (Q2).
- A message to the author on approval (Q15).
- Any change to world or save export shape.

## Further Notes

- Ship this client before the operator turns the server's `listing_review` setting on. The setting defaults to off.
- Changelog: one entry for players and authors, and one in the staff bucket for the Review tab.
