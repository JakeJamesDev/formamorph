# 07: Author Review Status

Status: ready-for-agent
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

- [ ] The rules module maps each server shape to `live`, `pending`, `updatePending`, `rejected` or `resubmitted`, and lists changed fields for an update.
- [ ] The service passes through `moderation_state`, `has_pending_update` and `pending_update`, and calls `/api/reviews/meta`.
- [ ] Detection treats `404` as absent and does not cache a transient failure.
- [ ] The listing card, details modal and creations tab show the Pending Review and Resubmitted badges, reusing the quarantine marker pattern.
- [ ] Publish shows "Sent for review" for a pending result and today's message for a live one.
- [ ] Frames: `.scratch/frames/pending-badge-{light,dark}.png` and `.scratch/frames/resubmitted-badge-{light,dark}.png` at desktop width.
- [ ] Copy follows the Writing Guide; a copy sweep runs on the new strings.
- [ ] A changelog fragment covers the author-facing change.

For you: whether the badge reads clearly on a card in the community browser.
