# 07: Author Review Status

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Implementation Decisions: Rules module, Service, Feature detection, Author surfaces, Publish result)

Model rationale: a pure module plus badges on three existing surfaces; detection copies a known pattern.

## What to build

Authors see where their listing stands. A waiting listing shows **Pending Review**; a rejected one shows the quarantine notice; a fixed rejected one shows **Resubmitted** with its deadline. Publish says "Sent for review" when the listing waits. Against a server without review, nothing new shows.

This ticket owns the rules module that tickets 08–10 read.

## Acceptance criteria

- [x] The rules module maps each server shape to `live`, `pending`, `updatePending`, `rejected` or `resubmitted`, and lists changed fields for an update. `src/lib/listingModeration.test.ts`; the resubmitted branch was mutation-checked.
- [x] The service passes through `moderation_state`, `has_pending_update` and `pending_update`, and calls `/api/reviews/meta`. Catalog rows pass through untouched; `UserService.test.ts` "reads each row's review status"; `ReviewService.test.ts` "asks the meta route".
- [x] Detection treats `404` as absent and does not cache a transient failure. `ReviewService.test.ts` and `useListingReviewMeta.test.tsx`; both guards were mutation-checked.
- [x] The listing card, details modal and creations tab show the Pending Review and Resubmitted badges, reusing the quarantine marker pattern. `RemoteWorldCard.quarantine.test.tsx` "the review badges", `RemoteWorldDetailsModal.moderation.test.tsx`, `UserCreationsTab.test.tsx` "a listing in review".
- [x] Publish shows "Sent for review" for a pending result and today's message for a live one. `PublishModal.review.test.tsx`; the toast reads "{Kind} sent for review" (spec session ruling 8).
- [x] Frames: `.scratch/frames/pending-badge-{light,dark}.png` and `.scratch/frames/resubmitted-badge-{light,dark}.png` at desktop width. Playwright, 1440×900, the design-system card showcase with temporary review fields (reverted).
- [x] Copy follows the Writing Guide; a copy sweep runs on the new strings. `npm run copy:sweep`: 0 notices on the new files and strings.
- [x] A changelog fragment covers the author-facing change. `docs-internal/changelog.d/listing-review-07.md`.

For you: whether the badge reads clearly on a card in the community browser.

## Landed

**Not verified**

- The unmount guard in `useListingReviewMeta` (`useMountedRef`). A test unmounts mid-request, but React 18 drops a late `setState` silently, so removing the guard fails no test.

**For you**

- Whether the badge reads clearly on a card in the community browser. See `.scratch/listing-review-07/frames/pending-badge-light.png` and `.scratch/listing-review-07/frames/resubmitted-badge-dark.png`.
