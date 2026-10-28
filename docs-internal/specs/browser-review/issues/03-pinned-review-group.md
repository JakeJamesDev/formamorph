# 03: Pinned Review Group

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Model note: splits the browser's client-side filter, sort and page pipeline
Reasoning effort: high

## What to build

In Community Creations, staff see every listing that awaits review pinned above the normal results, with a **Show Pending** toggle for the player view. Cards have no check or X yet. See the spec's **Browser pipeline** and **Show Pending** modules.

## Acceptance criteria

- [x] Staff see new, resubmitted and Update Pending listings in one pinned group above page 1, oldest-queued first, regardless of the browser's sort. Tests "pins new, resubmitted and update listings…" and "orders an update by its own queue time…" (`CommunityCreationsBrowser.pinnedReview.test.tsx`); updates sort by `pending_preview.queued_at` (ruling 1).
- [x] A non-staff viewer never sees another author's new or resubmitted pending listing, and gets no pinned group; the test fails when the staff guard is removed. Their own pending listings keep their badge in the normal slot. Test "shows no group and no toggle to a player…"; staff-guard mutation turns it red.
- [x] The pinned group follows kind, search and filters. Tests "follows the search", "follows a tag filter", "follows the kind", "follows the hide preferences".
- [x] The pinned group shows on page 1 only and does not shrink the page. Test "shows on page 1 only and leaves the page full" (12 normal cards plus the group).
- [x] An Update Pending listing shows once: in the pinned group, not also in its normal slot. Test "shows an update listing once, in the group".
- [x] With **Show Pending** off, staff get the player view: new pending listings are hidden and updates sit in their normal slot with their live face. Test "off gives the player view…" (own pending listings stay, ruling 2).
- [x] **Show Pending** is on by default, shows only for staff, and survives a remount. Tests "is on by default", "shows for staff with nothing pending", "stays off across a remount", and the player test; hidden on the contest tab (contest test "staff review on the contest tab").
- [x] The Quarantined view shows no pinned group. Test "shows no group in the Quarantined view".
- [x] A `devRoutes` entry opens the staff browser with a pinned group from the dev review stub. `#dev?modal=community&fixture=review`, read in the frames below.
- [x] A changelog fragment adds the 👤 User-facing → Added entry for staff review in Community Creations. `docs-internal/changelog.d/browser-review-03.md`, in the **Browser Review** group.
- [x] Frames: `.scratch/frames/pinned-group-light.png` and `.scratch/frames/pinned-group-dark.png` at 1280px wide. Playwright at 1280×800.

For you: open the dev route and judge whether the pinned group reads as separate from the normal results.

## Landed

Look per Q14 (option A: heading, same grid, divider) and Q15 (pinned cards show the badge title only; test "gives pinned cards the badge title without its hint"). `RemoteWorldCard` takes `inReviewGroup` for tickets 04 and 05 to build on.

**Not verified**
- Pinned updates sort by `pending_preview.queued_at` only once server ticket 01 deploys; until then they fall back to `updated_at`.

**For you**
- For you: open the dev route and judge whether the pinned group reads as separate from the normal results. `#dev?modal=community&fixture=review`; frames `.scratch/browser-review-03/frames/pinned-group-light.png` and `.scratch/browser-review-03/frames/pinned-group-dark.png`.
