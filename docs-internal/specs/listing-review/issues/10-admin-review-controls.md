# 10: Admin Review Controls

Status: done
Blocked by: 04, 08
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Admin controls, Review tab, Audit log)

Model rationale: a toggle, a switch and a list view on existing surfaces; little new logic.

## What to build

Admins toggle **Trusted** on an account in the Users tab and see a trusted marker in the list. The server settings tab gets a **Listing Review** switch. The Review tab gains an **Auto-Approved** view that lists recent auto-approvals and opens each listing.

## Acceptance criteria

- [x] The Trusted toggle and marker show for admins only; mods never see the toggle. (`ManageUsersTab.test.tsx` "never shows a moderator the toggle or the marker"; red when the admin guard goes)
- [x] The toggle calls the trust routes and reflects the answer. (`ManageUsersTab.test.tsx` grant, revoke and refusal; `ReviewService.test.ts` PUT and DELETE)
- [x] The Listing Review switch writes `listing_review`; its help line says pending items stay in the queue when it is off. (`ServerSettingsTab.test.tsx` "the Listing Review switch")
- [x] The Auto-Approved view lists `/api/reviews/auto` newest first; each row opens its listing. (`AutoApprovedTab.test.tsx`, `ReviewService.test.ts`)
- [x] The trust audit actions get labels, a pill style and filter entries. (`AuditLogTab.test.tsx` "trust")
- [x] The Auto-Approved view has a `devRoutes` entry. (`adminPanelModeration` lists `auto`; `devRouter.test.ts` green)
- [x] Frames: `.scratch/frames/trusted-toggle-{light,dark}.png` and `.scratch/frames/auto-approved-{light,dark}.png` at desktop width.

## Comments

Spec session rulings, 2026-10-25:

- Auto-Approved is a third segment of the Moderation control (Reports | Review | Auto-Approved), not a nested control. No count on it. The three segments wrap their labels so they fit at 375px; `admin-panel-widths.spec.ts` measures all three in every font.
- The toggle is hidden on staff rows, which skip review. The Trusted pill shows on any row with `trustedAt`.
- Pill labels: "Trusted" and "Trust Removed". `setListingReviewEnabled` in `useListingReviewMeta.ts` keeps the cached `enabled` fresh after an admin writes the switch.

## Landed

**Not verified**
- None. The e2e fit spec ran on the desktop and mobile projects.

**For you**
- Look at the Trusted pill under the username and the Trust Author item in the caret menu: Users tab, `.scratch/listing-review-10/frames/trusted-toggle-light.png`.
- Look at the Auto-Approved list: Moderation tab, third segment, `.scratch/listing-review-10/frames/auto-approved-light.png`.
