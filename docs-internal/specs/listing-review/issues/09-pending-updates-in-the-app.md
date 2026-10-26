# 09: Pending Updates In The App

Status: ready-for-agent
Blocked by: 06, 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Author surfaces, Publish result, Item detail, Reject flow, Approval refused during judging)

Model rationale: a compare view on both sides of the app; the side-by-side table may need a design approval.

## What to build

Authors see **Update Pending** on a live listing with a waiting update, can compare live and pending, and can discard the update. A changelog entry added after an update shows as pending. Mods see updates in the item dialog as a field table with both thumbnails and the changelog operations. Rejecting an update opens the composer with a rejected-update template. An approval refused during judging shows a toast.

## Acceptance criteria

- [ ] The card, details modal and creations tab show Update Pending from `has_pending_update`.
- [ ] The details modal's Pending Update section has Compare and Discard Update; Discard asks first.
- [ ] The pending thumbnail loads from the review thumbnail URL, fetched with the Bearer token (a plain image `src` cannot authenticate; ruling T30).
- [ ] The publish modal shows a changelog entry posted after an update as pending.
- [ ] The item dialog shows changed fields live versus pending, both thumbnails, and the changelog operations.
- [ ] Rejecting an update asks first, then opens the composer with a new rejected-update template.
- [ ] A judging `409` shows a toast that the approval waits for contest results.
- [ ] If the field table needs a new visual pattern, the user approved it before landing.
- [ ] The Pending Update section has a `devRoutes` entry.
- [ ] Frames: `.scratch/frames/pending-update-compare-{light,dark}.png` and `.scratch/frames/review-update-item-{light,dark}.png` at desktop width.

For you: whether the compare view makes a changed field obvious at a glance.
