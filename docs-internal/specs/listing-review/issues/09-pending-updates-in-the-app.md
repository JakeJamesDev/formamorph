# 09: Pending Updates In The App

Status: done
Blocked by: 06, 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Author surfaces, Publish result, Item detail, Reject flow, Approval refused during judging)

Model rationale: a compare view on both sides of the app; the side-by-side table may need a design approval.

## What to build

Authors see **Update Pending** on a live listing with a waiting update, can compare live and pending, and can discard the update. A changelog entry added after an update shows as pending. Mods see updates in the item dialog as a field table with both thumbnails and the changelog operations. Rejecting an update opens the composer with a rejected-update template. An approval refused during judging shows a toast.

## Acceptance criteria

- [x] The card, details modal and creations tab show Update Pending from `has_pending_update`. `RemoteWorldCard.quarantine.test.tsx` "marks a live listing whose update waits", `RemoteWorldDetailsModal.pendingUpdate.test.tsx`, `UserCreationsTab.test.tsx` "is marked update pending".
- [x] The details modal's Pending Update section has Compare and Discard Update; Discard asks first. `RemoteWorldDetailsModal.pendingUpdate.test.tsx` (compare, cancel, confirm, failure, already decided, unmount mid-discard).
- [x] The pending thumbnail loads from the review thumbnail URL, fetched with the Bearer token (a plain image `src` cannot authenticate; ruling T30). `ReviewService.test.ts` "reads the held thumbnail … Bearer token"; `ReviewTab.test.tsx` checks the object URL `src`.
- [x] The publish modal shows a changelog entry posted after an update as pending. Toast "{Kind} sent for review with its changelog entry" (`PublishModal.changelog.test.tsx`); held creates list with a Pending tag in the Changelog panel (spec-session ruling 4).
- [x] The item dialog shows changed fields live versus pending, both thumbnails, and the changelog operations. `ReviewTab.test.tsx` "shows an update as its changed fields …"; frame below.
- [x] Rejecting an update asks first, then opens the composer with a new rejected-update template. (Ticket 08 already confirms and skips the composer; this adds the template and the composer step.) `ReviewTab.test.tsx` "confirms an update, then opens the composer on the rejected-update template".
- [x] A judging `409` (code `CONTEST_LOCKED`) shows a toast that the approval waits for contest results. (Ticket 08 keeps the row and toasts the server's text; this replaces that with the judging copy.) `ReviewTab.test.tsx`; any other update `409` now drops the row (ruling 6).
- [x] The field table also covers `visibility`, `spoiler`, `required_dependencies` and `compatible_worlds`, and the changelog list renders `create`, `edit` and `delete` ops (rulings T32–T35). `ReviewTab.test.tsx` (visibility, spoiler, dependencies, create, delete); `compatible_worlds` shares the id-list path and its label test; the edit op shows in the frame.
- [x] If the field table needs a new visual pattern, the user approved it before landing. Approved as is, 2026-10-26, from the frames.
- [x] The Pending Update section has a `devRoutes` entry. `#dev?modal=pendingUpdate&tab=compare&fixture=review`; `devRouter.test.ts`.
- [x] Frames: `.scratch/frames/pending-update-compare-{light,dark}.png` and `.scratch/frames/review-update-item-{light,dark}.png` at desktop width. Playwright, 1440×900, from the dev routes with `fixture=review`.

For you: whether the compare view makes a changed field obvious at a glance.

## Landed

**Not verified**

- Discard, the held thumbnail and held changelog writes against a live server. Tests and frames use mocked services and the `fixture=review` stub.
- The review item frame shows no Approve or Reject: the Playwright profile is not signed in as staff, so the dialog says another staff member decides.

**For you**

- Whether the compare view makes a changed field obvious at a glance. See `.scratch/listing-review-09/frames/pending-update-compare-light.png` and `.scratch/listing-review-09/frames/pending-update-compare-dark.png`.
- Whether the mod's update item reads clearly. See `.scratch/listing-review-09/frames/review-update-item-light.png` and `.scratch/listing-review-09/frames/review-update-item-dark.png`.
- Added and removed chips carry no visible word, only a green ring or a strikethrough, as approved. Screen readers hear "added" or "removed".
